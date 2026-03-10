use axum::{
    extract::{Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use socketioxide::{
    extract::{AckSender, Data, SocketRef, State as SocketState},
    SocketIo,
};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};

#[derive(Debug, Clone)]
struct SocketIndex {
    session_id: String,
    player_id: String,
    last_chat_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Peer {
    source: String,
    target: String,
}

#[derive(Debug, Clone)]
struct Room {
    owner: String,
    players: HashMap<String, Value>,
    peers: Vec<Peer>,
    room_name: String,
    game_id: String,
    domain: String,
    password: Option<String>,
    max_players: usize,
}

#[derive(Clone)]
struct AppState {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
    index: Arc<RwLock<HashMap<String, SocketIndex>>>,
    games: Arc<RwLock<HashMap<String, Value>>>,
}

#[derive(Deserialize)]
struct ListQuery {
    domain: Option<String>,
    game_id: Option<String>,
}

#[derive(Serialize)]
struct RoomInfo {
    room_name: String,
    current: usize,
    max: usize,
    player_name: String,
    #[serde(rename = "hasPassword")]
    has_password: bool,
    #[serde(rename = "gameId")]
    game_id: String,
}

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

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_millis() as u64
}

fn normalize_password(p: Option<String>) -> Option<String> {
    let p = p?.trim().to_string();
    if p.is_empty() || p.eq_ignore_ascii_case("none") {
        None
    } else {
        Some(p)
    }
}

fn v_to_string_lossy(v: &Value, k: &str) -> Option<String> {
    let x = v.get(k)?;
    if let Some(s) = x.as_str() {
        Some(s.to_string())
    } else if x.is_number() || x.is_boolean() {
        Some(x.to_string())
    } else {
        None
    }
}

fn value_to_string_lossy(x: &Value) -> Option<String> {
    if let Some(s) = x.as_str() {
        Some(s.to_string())
    } else if x.is_number() || x.is_boolean() {
        Some(x.to_string())
    } else {
        None
    }
}

async fn list_rooms(
    Query(q): Query<ListQuery>,
    State(state): State<AppState>,
) -> Json<HashMap<String, RoomInfo>> {
    let Some(dom) = q.domain else { return Json(HashMap::new()); };
    let Some(gid) = q.game_id else { return Json(HashMap::new()); };

    let rooms = state.rooms.read().await;
    let mut out = HashMap::new();

    for (session_id, room) in rooms.iter() {
        if room.domain != dom || room.game_id != gid {
            continue;
        }

        let owner_name = room
            .players
            .values()
            .find(|p| p.get("socketId").and_then(|v| v.as_str()) == Some(room.owner.as_str()))
            .and_then(|p| p.get("player_name").and_then(|v| v.as_str()))
            .unwrap_or("Unknown");

        out.insert(
            session_id.clone(),
            RoomInfo {
                room_name: room.room_name.clone(),
                current: room.players.len(),
                max: room.max_players,
                player_name: owner_name.to_string(),
                has_password: room.password.is_some(),
                game_id: room.game_id.clone(),
            },
        );
    }

    Json(out)
}

async fn games(State(state): State<AppState>) -> Json<HashMap<String, Value>> {
    let g = state.games.read().await;
    Json(g.clone())
}

fn collect_socket_ids(players: &HashMap<String, Value>) -> Vec<String> {
    players
        .values()
        .filter_map(|p| p.get("socketId").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect()
}

async fn emit_to_sockets_including_self(
    s: &SocketRef,
    socket_ids: &[String],
    event: &str,
    payload: &Value,
) {
    for sid in socket_ids {
        if sid == &s.id.to_string() {
            let _ = s.emit(event, payload);
        } else {
            let _ = s.to(sid.clone()).emit(event, payload).await;
        }
    }
}

async fn emit_to_sockets_excluding_self(
    s: &SocketRef,
    socket_ids: &[String],
    event: &str,
    payload: &Value,
) {
    let me = s.id.to_string();
    for sid in socket_ids {
        if sid != &me {
            let _ = s.to(sid.clone()).emit(event, payload).await;
        }
    }
}

async fn leave_internal(s: &SocketRef, state: &AppState) {
    let sid = s.id.to_string();

    let idx = {
        let index = state.index.read().await;
        index.get(&sid).cloned()
    };
    let Some(idx) = idx else { return };

    let session_id = idx.session_id.clone();
    let player_id = idx.player_id.clone();

    let mut players_snapshot: HashMap<String, Value> = HashMap::new();
    let mut socket_ids_snapshot: Vec<String> = vec![];
    let mut new_owner_renegotiate: Option<(String, String)> = None;

    {
        let mut rooms = state.rooms.write().await;
        if let Some(room) = rooms.get_mut(&session_id) {
            room.players.remove(&player_id);
            room.peers.retain(|p| p.source != sid && p.target != sid);

            if room.owner == sid && !room.players.is_empty() {
                if let Some(next_owner) = room
                    .players
                    .values()
                    .next()
                    .and_then(|v| v.get("socketId"))
                    .and_then(|v| v.as_str())
                {
                    let new_owner = next_owner.to_string();
                    room.owner = new_owner.clone();

                    for peer in room.peers.iter_mut() {
                        if peer.source == sid {
                            peer.source = new_owner.clone();
                        }
                    }

                    if let Some(first_peer) = room.peers.first() {
                        new_owner_renegotiate = Some((new_owner, first_peer.target.clone()));
                    }
                }
            }

            players_snapshot = room.players.clone();
            socket_ids_snapshot = collect_socket_ids(&players_snapshot);

            if room.players.is_empty() {
                rooms.remove(&session_id);
            }
        }
    }

    if let Some((new_owner_socket_id, target_socket_id)) = new_owner_renegotiate {
        let payload = json!({ "target": target_socket_id, "requestRenegotiate": true });
        let _ = s.to(new_owner_socket_id).emit("webrtc-signal", &payload).await;
    }

    if !socket_ids_snapshot.is_empty() {
        let payload = Value::Object(players_snapshot.into_iter().collect());
        emit_to_sockets_excluding_self(s, &socket_ids_snapshot, "users-updated", &payload).await;
    }

    {
        let mut index = state.index.write().await;
        index.remove(&sid);
    }

    let _ = s.leave(session_id);
}

async fn on_connect(socket: SocketRef) {
    socket.join(socket.id.to_string());

    socket.on(
        "open-room",
        |s: SocketRef,
         Data::<OpenRoomData>(data),
         SocketState::<AppState>(state),
         ack: AckSender| async move {
            let mut extra = data.extra.unwrap_or_else(|| json!({}));
            if !extra.is_object() {
                extra = json!({});
            }

            let session_id = v_to_string_lossy(&extra, "sessionid").unwrap_or_default();
            let player_id = v_to_string_lossy(&extra, "userid")
                .or_else(|| v_to_string_lossy(&extra, "playerId"))
                .unwrap_or_default();

            if session_id.is_empty() || player_id.is_empty() {
                let _ = ack.send(&("Invalid data: sessionId and playerId required",));
                return;
            }

            let room_name = v_to_string_lossy(&extra, "room_name")
                .unwrap_or_else(|| format!("Room {}", session_id));

            let game_id = v_to_string_lossy(&extra, "game_id").unwrap_or_else(|| "default".into());
            let domain = v_to_string_lossy(&extra, "domain").unwrap_or_else(|| "unknown".into());
            let max_players = data.max_players.unwrap_or(4);
            let password = normalize_password(data.password);

            extra["socketId"] = json!(s.id.to_string());

            let mut players = HashMap::new();
            players.insert(player_id.clone(), extra);

            {
                let mut rooms = state.rooms.write().await;
                if rooms.contains_key(&session_id) {
                    let _ = ack.send(&("Room already exists",));
                    return;
                }

                rooms.insert(
                    session_id.clone(),
                    Room {
                        owner: s.id.to_string(),
                        players: players.clone(),
                        peers: vec![],
                        room_name,
                        game_id,
                        domain,
                        password,
                        max_players,
                    },
                );
            }

            s.join(session_id.clone());

            {
                let mut index = state.index.write().await;
                index.insert(
                    s.id.to_string(),
                    SocketIndex {
                        session_id: session_id.clone(),
                        player_id: player_id.clone(),
                        last_chat_at: 0,
                    },
                );
            }

            let _ = ack.send(&(Value::Null,));

            let socket_ids = vec![s.id.to_string()];
            let payload = json!(players);
            emit_to_sockets_including_self(&s, &socket_ids, "users-updated", &payload).await;
        },
    );

    socket.on(
        "join-room",
        |s: SocketRef,
         Data::<JoinRoomData>(data),
         SocketState::<AppState>(state),
         ack: AckSender| async move {
            let mut extra = data.extra.unwrap_or_else(|| json!({}));
            if !extra.is_object() {
                extra = json!({});
            }

            let session_id = v_to_string_lossy(&extra, "sessionid").unwrap_or_default();
            let player_id = v_to_string_lossy(&extra, "userid")
                .or_else(|| v_to_string_lossy(&extra, "playerId"))
                .unwrap_or_default();

            if session_id.is_empty() || player_id.is_empty() {
                let _ = ack.send(&("Invalid data: sessionId and playerId required",));
                return;
            }

            let provided_pw = normalize_password(data.password);

            let (players_snapshot, socket_ids_snapshot) = {
                let mut rooms = state.rooms.write().await;
                let Some(room) = rooms.get_mut(&session_id) else {
                    let _ = ack.send(&("Room not found",));
                    return;
                };

                if let Some(ref room_pw) = room.password {
                    if provided_pw.as_deref() != Some(room_pw.as_str()) {
                        let _ = ack.send(&("Incorrect password",));
                        return;
                    }
                }

                if room.players.len() >= room.max_players {
                    let _ = ack.send(&("Room full",));
                    return;
                }

                extra["socketId"] = json!(s.id.to_string());
                room.players.insert(player_id.clone(), extra);

                let snap = room.players.clone();
                let sids = collect_socket_ids(&snap);
                (snap, sids)
            };

            s.join(session_id.clone());

            {
                let mut index = state.index.write().await;
                index.insert(
                    s.id.to_string(),
                    SocketIndex {
                        session_id: session_id.clone(),
                        player_id: player_id.clone(),
                        last_chat_at: 0,
                    },
                );
            }

            let _ = ack.send(&(Value::Null, json!(players_snapshot.clone())));

            let payload = json!(players_snapshot);
            emit_to_sockets_including_self(&s, &socket_ids_snapshot, "users-updated", &payload).await;
        },
    );

    socket.on(
        "leave-room",
        |s: SocketRef, SocketState::<AppState>(state)| async move {
            leave_internal(&s, &state).await;
        },
    );

    socket.on_disconnect(
        |s: SocketRef, SocketState::<AppState>(state)| async move {
            leave_internal(&s, &state).await;
        },
    );

    socket.on(
        "chat-message",
        |s: SocketRef, Data::<Value>(data), SocketState::<AppState>(state), ack: AckSender| async move {
            let (session_id, player_id, now) = {
                let mut index_lock = state.index.write().await;
                let Some(idx) = index_lock.get_mut(&s.id.to_string()) else {
                    let _ = ack.send(&(json!({ "ok": false, "error": "Not in a room" }),));
                    return;
                };

                let now = now_ms();
                if now - idx.last_chat_at < 400 {
                    let _ = ack.send(&(json!({ "ok": false, "error": "Slow down" }),));
                    return;
                }

                idx.last_chat_at = now;
                (idx.session_id.clone(), idx.player_id.clone(), now)
            };

            let mut to_str = "all".to_string();
            let mut message = String::new();

            if let Some(msg_str) = data.as_str() {
                message = msg_str.to_string();
            } else if let Some(obj) = data.as_object() {
                if let Some(t) = obj.get("to").and_then(value_to_string_lossy) {
                    to_str = t;
                }
                if let Some(m) = obj.get("message").and_then(|v| v.as_str()) {
                    message = m.to_string();
                }
            }

            message = message.split_whitespace().collect::<Vec<_>>().join(" ");
            message = message.chars().take(300).collect();

            if message.is_empty() {
                let _ = ack.send(&(json!({ "ok": false, "error": "Empty message" }),));
                return;
            }

            to_str = to_str.trim().to_string();
            if to_str.is_empty() {
                to_str = "all".to_string();
            }

            let (player_name, socket_ids, target_socket_opt) = {
                let rooms = state.rooms.read().await;
                let Some(room) = rooms.get(&session_id) else {
                    let _ = ack.send(&(json!({ "ok": false, "error": "Room not found" }),));
                    return;
                };

                let Some(from_player) = room.players.get(&player_id) else {
                    let _ = ack.send(&(json!({ "ok": false, "error": "Not in room" }),));
                    return;
                };

                let player_name = v_to_string_lossy(from_player, "player_name")
                    .unwrap_or_else(|| "Unknown".to_string());

                let socket_ids = collect_socket_ids(&room.players);

                let is_private = !to_str.eq_ignore_ascii_case("all") && to_str != player_id;

                let target_socket_opt = if is_private {
                    if let Some(target_player) = room.players.get(&to_str) {
                        target_player
                            .get("socketId")
                            .and_then(|v| v.as_str())
                            .map(|x| x.to_string())
                    } else {
                        let is_socket = room.players.values().any(|p| {
                            p.get("socketId").and_then(|v| v.as_str()) == Some(to_str.as_str())
                        });
                        if is_socket { Some(to_str.clone()) } else { None }
                    }
                } else {
                    None
                };

                (player_name, socket_ids, target_socket_opt)
            };

            let payload = json!({
                "ts": now,
                "to": if target_socket_opt.is_some() { to_str.clone() } else { "all".to_string() },
                "userid": player_id,
                "player_name": player_name,
                "message": message
            });

            if let Some(target_socket) = target_socket_opt {
                let _ = s.emit("chat-message", &payload);
                let _ = s.to(target_socket).emit("chat-message", &payload).await;
            } else {
                emit_to_sockets_including_self(&s, &socket_ids, "chat-message", &payload).await;
            }

            let _ = ack.send(&(json!({ "ok": true }),));
        },
    );

    socket.on(
        "webrtc-signal",
        |s: SocketRef, SocketState::<AppState>(state), Data::<WebRtcSignalData>(data)| async move {
            let sender = s.id.to_string();

            let session_id_opt = {
                let idx = state.index.read().await;
                idx.get(&sender).map(|x| x.session_id.clone())
            };

            let request = data.request_renegotiate.unwrap_or(false);
            if !request && data.target.is_none() {
                return;
            }

            let target = data.target.clone().unwrap_or_default();

            if data.offer.is_some() {
                if let Some(session_id) = session_id_opt.clone() {
                    let mut rooms = state.rooms.write().await;
                    if let Some(room) = rooms.get_mut(&session_id) {
                        let exists = room.peers.iter().any(|p| p.source == sender && p.target == target);
                        if !exists {
                            room.peers.push(Peer {
                                source: sender.clone(),
                                target: target.clone(),
                            });
                        }
                    }
                }
            }

            let mut m = serde_json::Map::<String, Value>::new();
            m.insert("sender".into(), json!(sender));

            if request {
                m.insert("requestRenegotiate".into(), json!(true));
            } else {
                if let Some(c) = data.candidate {
                    m.insert("candidate".into(), c);
                }
                if let Some(o) = data.offer {
                    m.insert("offer".into(), o);
                }
                if let Some(a) = data.answer {
                    m.insert("answer".into(), a);
                }
            }

            let payload = Value::Object(m);
            let _ = s.to(target.clone()).emit("webrtc-signal", &payload).await;
        },
    );

    socket.on(
        "data-message",
        |s: SocketRef, SocketState::<AppState>(state), Data::<Value>(d)| async move {
            let session_id = {
                let idx = state.index.read().await;
                idx.get(&s.id.to_string()).map(|x| x.session_id.clone())
            };
            let Some(session_id) = session_id else { return };

            let socket_ids = {
                let rooms = state.rooms.read().await;
                rooms.get(&session_id)
                    .map(|r| collect_socket_ids(&r.players))
                    .unwrap_or_default()
            };

            emit_to_sockets_excluding_self(&s, &socket_ids, "data-message", &d).await;
        },
    );

    socket.on(
        "snapshot",
        |s: SocketRef, SocketState::<AppState>(state), Data::<Value>(d)| async move {
            let session_id = {
                let idx = state.index.read().await;
                idx.get(&s.id.to_string()).map(|x| x.session_id.clone())
            };
            let Some(session_id) = session_id else { return };

            let socket_ids = {
                let rooms = state.rooms.read().await;
                rooms.get(&session_id)
                    .map(|r| collect_socket_ids(&r.players))
                    .unwrap_or_default()
            };

            emit_to_sockets_excluding_self(&s, &socket_ids, "snapshot", &d).await;
        },
    );

    socket.on(
        "input",
        |s: SocketRef, SocketState::<AppState>(state), Data::<Value>(d)| async move {
            let session_id = {
                let idx = state.index.read().await;
                idx.get(&s.id.to_string()).map(|x| x.session_id.clone())
            };
            let Some(session_id) = session_id else { return };

            let socket_ids = {
                let rooms = state.rooms.read().await;
                rooms.get(&session_id)
                    .map(|r| collect_socket_ids(&r.players))
                    .unwrap_or_default()
            };

            emit_to_sockets_excluding_self(&s, &socket_ids, "input", &d).await;
        },
    );
}

#[tokio::main]
async fn main() {
    let state = AppState {
        rooms: Arc::new(RwLock::new(HashMap::new())),
        index: Arc::new(RwLock::new(HashMap::new())),
        games: Arc::new(RwLock::new(HashMap::new())),
    };

    let cleanup = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            let mut rooms = cleanup.rooms.write().await;
            rooms.retain(|_, r| !r.players.is_empty());
        }
    });

    let (layer, io) = SocketIo::builder().with_state(state.clone()).build_layer();
    io.ns("/", on_connect);

    let cors = CorsLayer::new()
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_origin(Any);

    let app = Router::new()
        .route("/list", get(list_rooms))
        .route("/games", get(games))
        .with_state(state)
        .layer(layer)
        .layer(cors);

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".into())
        .parse()
        .unwrap();

    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
