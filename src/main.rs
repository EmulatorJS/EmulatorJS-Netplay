use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use socketioxide::{
    extract::{Data, SocketRef, State as SocketState},
    SocketIo,
};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::Duration,
};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::info;

// --- Shared Application State ---

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Peer {
    source: String,
    target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Room {
    owner: String,
    players: HashMap<String, Value>, 
    peers: Vec<Peer>,
    #[serde(rename = "roomName")]
    room_name: String,
    #[serde(rename = "gameId")]
    game_id: i64,
    domain: String,
    password: String,
    #[serde(rename = "maxPlayers")]
    max_players: usize,
}

type AppState = Arc<RwLock<HashMap<String, Room>>>;

// --- HTTP Route Structs ---

#[derive(Deserialize)]
struct ListQuery {
    game_id: i64,
}

#[derive(Serialize)]
struct RoomInfo {
    room_name: String,
    current: usize,
    max: usize,
    player_name: String,
    #[serde(rename = "hasPassword")]
    has_password: bool,
}

// --- Socket Payload Structs ---

#[derive(Deserialize)]
struct OpenRoomData {
    extra: Option<Value>,
    password: Option<String>,
    #[serde(rename = "maxPlayers")]
    max_players: Option<usize>,
}

#[derive(Deserialize)]
struct JoinRoomData {
    extra: Option<Value>,
    password: Option<String>,
}

#[derive(Deserialize)]
struct WebRtcSignalData {
    target: Option<String>,
    candidate: Option<Value>,
    offer: Option<Value>,
    answer: Option<Value>,
    #[serde(rename = "requestRenegotiate")]
    request_renegotiate: Option<bool>,
}

// --- Main HTTP Endpoints ---

async fn list_rooms(
    Query(query): Query<ListQuery>,
    State(rooms): State<AppState>,
) -> Json<HashMap<String, RoomInfo>> {
    let rooms_lock = rooms.read().await;
    let mut response = HashMap::new();

    for (session_id, room) in rooms_lock.iter() {
        if room.players.len() < room.max_players && room.game_id == query.game_id {
            let owner_name = room
                .players
                .values()
                .find(|p| p.get("socketId").and_then(|v| v.as_str()) == Some(&room.owner))
                .and_then(|p| p.get("player_name").and_then(|v| v.as_str()))
                .unwrap_or("Unknown");

            response.insert(
                session_id.clone(),
                RoomInfo {
                    room_name: room.room_name.clone(),
                    current: room.players.len(),
                    max: room.max_players,
                    player_name: owner_name.to_string(),
                    has_password: !room.password.trim().is_empty(),
                },
            );
        }
    }
    Json(response)
}

// --- Helper Functions ---

async fn get_session_id_for_socket(rooms: &AppState, socket_id: &str) -> Option<String> {
    let rooms_lock = rooms.read().await;
    rooms_lock.iter().find_map(|(s_id, r)| {
        r.players.values()
         .any(|p| p.get("socketId").and_then(|v| v.as_str()) == Some(socket_id))
         .then(|| s_id.clone())
    })
}

async fn handle_leave(s: SocketRef, rooms: AppState) {
    let mut rooms_lock = rooms.write().await;
    let mut found = None;
    let s_id_str = s.id.to_string();

    for (session_id, room) in rooms_lock.iter() {
        if room.players.values().any(|p| p.get("socketId").and_then(|v| v.as_str()) == Some(&s_id_str)) {
            let player_id = room.players.iter()
                .find(|(_, p)| p.get("socketId").and_then(|v| v.as_str()) == Some(&s_id_str))
                .map(|(k, _)| k.clone());
            if let Some(pid) = player_id {
                found = Some((session_id.clone(), pid));
            }
            break;
        }
    }

    if let Some((session_id, player_id)) = found {
        if let Some(room) = rooms_lock.get_mut(&session_id) {
            room.players.remove(&player_id);
            room.peers.retain(|p| p.source != s_id_str && p.target != s_id_str);
            
            let _ = s.within(session_id.clone()).emit("users-updated", &room.players);

            if room.players.is_empty() {
                rooms_lock.remove(&session_id);
            } else if s_id_str == room.owner {
                if let Some(new_owner_socket) = room.players.values().next().and_then(|v| v.get("socketId")).and_then(|v| v.as_str()) {
                    let new_owner = new_owner_socket.to_string();
                    room.owner = new_owner.clone();
                    // ... rest of the owner logic remains same ...
                    let _ = s.within(session_id).emit("users-updated", &room.players);
                }
            }
        }
    }
}

// --- Socket Handlers ---

async fn on_connect(socket: SocketRef) {

    socket.on("open-room", |s: SocketRef, Data::<OpenRoomData>(data), SocketState::<AppState>(rooms)| async move {
        let extra = data.extra.unwrap_or(json!({}));
        let session_id = extra.get("sessionid").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let player_id = extra.get("userid").or_else(|| extra.get("playerId")).and_then(|v| v.as_str()).unwrap_or("").to_string();

        if session_id.is_empty() || player_id.is_empty() {
            let _ = s.emit("open-room-result", json!({ "success": false, "message": "Invalid data: sessionId and playerId required" }));
            return;
        }

        let mut rooms_lock = rooms.write().await;
        if rooms_lock.contains_key(&session_id) {
            let _ = s.emit("open-room-result", json!({ "success": false, "message": "Room already exists" }));
            return;
        }

        // Room setup logic...
        let room_name = extra.get("room_name").and_then(|v| v.as_str()).unwrap_or(&format!("Room {}", session_id)).to_string();
        let game_id = extra.get("game_id").and_then(|v| v.as_i64()).unwrap_or(0);
        let domain = extra.get("domain").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
        let max_players = data.max_players.unwrap_or(4);

        let mut player_data = extra.clone();
        player_data["socketId"] = json!(s.id.to_string());
        let mut players = HashMap::new();
        players.insert(player_id.clone(), player_data);

        let room = Room {
            owner: s.id.to_string(),
            players,
            peers: vec![],
            room_name,
            game_id,
            domain,
            password: data.password.unwrap_or(String::new()),
            max_players,
        };
        rooms_lock.insert(session_id.clone(), room.clone());
        let _ = s.join(session_id.clone());
        let _ = s.emit("open-room-result", json!({ "success": true, "room": room }));
    });

    socket.on("join-room", |s: SocketRef, Data::<JoinRoomData>(data), SocketState::<AppState>(rooms)| async move {
        let extra = data.extra.unwrap_or(json!({}));
        let session_id = extra.get("sessionid").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let player_id = extra.get("userid").and_then(|v| v.as_str()).unwrap_or("").to_string();

        if session_id.is_empty() || player_id.is_empty() {
            let _ = s.emit("join-room-result", json!({ "success": false, "message": "Invalid data: sessionId and playerId required" }));
            return;
        }

        let mut rooms_lock = rooms.write().await;
        let room = match rooms_lock.get_mut(&session_id) {
            Some(r) => r,
            None => {
                let _ = s.emit("join-room-result", json!({ "success": false, "message": "Room not found" }));
                return;
            },
        };

        if room.password != data.password.unwrap_or(String::new()) {
            let _ = s.emit("join-room-result", json!({ "success": false, "message": "Incorrect password" }));
            return;
        }

        if room.players.len() >= room.max_players {
            let _ = s.emit("join-room-result", json!({ "success": false, "message": "Room full" }));
            return;
        }

        let mut player_data = extra.clone();
        player_data["socketId"] = json!(s.id.to_string());
        room.players.insert(player_id, player_data);

        let _ = s.join(session_id.clone());
        let _ = s.emit("join-room-result", json!({ "success": true, "room": room }));
    });

    // These smaller handlers usually don't have trait issues
    socket.on("webrtc-signal", |s: SocketRef, Data::<WebRtcSignalData>(data)| async move {
        let request_renegotiate = data.request_renegotiate.unwrap_or(false);
        if let Some(target) = data.target {
            if request_renegotiate {
                let _ = s.to(target).emit("webrtc-signal", json!({
                    "sender": s.id.to_string(),
                    "requestRenegotiate": true,
                }));
            } else {
                let _ = s.to(target).emit("webrtc-signal", json!({
                    "sender": s.id.to_string(),
                    "candidate": data.candidate,
                    "offer": data.offer,
                    "answer": data.answer,
                }));
            }
        }
    });

    socket.on("data-message", |s: SocketRef, SocketState::<AppState>(rooms), Data::<Value>(data)| async move {
        if let Some(session_id) = get_session_id_for_socket(&rooms, &s.id.to_string()).await {
            let _ = s.to(session_id).emit("data-message", &data);
        }
    });

    socket.on("snapshot", |s: SocketRef, SocketState::<AppState>(rooms), Data::<Value>(data)| async move {
        if let Some(session_id) = get_session_id_for_socket(&rooms, &s.id.to_string()).await {
            let _ = s.to(session_id).emit("snapshot", &data);
        }
    });

    socket.on("input", |s: SocketRef, SocketState::<AppState>(rooms), Data::<Value>(data)| async move {
        if let Some(session_id) = get_session_id_for_socket(&rooms, &s.id.to_string()).await {
            let _ = s.to(session_id).emit("input", &data);
        }
    });

    // For disconnect/leave, we use the helper logic
    socket.on("leave-room", |s: SocketRef, SocketState::<AppState>(rooms)| async move {
        handle_leave(s, rooms).await;
    });

    socket.on_disconnect(|s: SocketRef, SocketState::<AppState>(rooms)| async move {
        handle_leave(s, rooms).await;
    });
}
// --- Main Entrypoint ---

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state: AppState = Arc::new(RwLock::new(HashMap::new()));
    let state_for_cleanup = state.clone();

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            let mut rooms_lock = state_for_cleanup.write().await;
            rooms_lock.retain(|_, room| !room.players.is_empty());
        }
    });

    // Setup Socket.io Server
    let (layer, io) = SocketIo::builder()
        .with_state(state.clone())
        .build_layer();

    io.ns("/", on_connect);

    let cors = CorsLayer::permissive();

    let app = Router::new()
        .route("/list", get(list_rooms))
        .with_state(state)
        .layer(layer)
        .layer(cors);

    let port: u16 = std::env::var("PORT").unwrap_or_else(|_| "3000".into()).parse().unwrap();
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    
    info!("Server running on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}