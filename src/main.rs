use axum::{response::IntoResponse, routing::get, Router, extract::Path};
use mime_guess::from_path;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use socketioxide::{
    extract::{AckSender, Bin, Data, SocketRef},
    SocketIo,
};
use tokio::fs::{read_to_string, File};
use tokio::io::AsyncReadExt;
use tracing::info;
use tracing_subscriber::FmtSubscriber;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
struct Config {
    port: u16,
}

async fn read_config() -> Config {
    match read_to_string("config.json").await {
        Ok(config_content) => {
            if let Ok(config) = serde_json::from_str::<Config>(&config_content) {
                config
            } else {
                Config { port: 3000 }
            }
        }
        Err(_) => Config { port: 3000 },
    }
}

fn on_connect(socket: SocketRef, Data(data): Data<Value>) {
    info!("Socket.IO connected: {:?} {:?}", socket.ns(), socket.id);
    socket.emit("auth", data).ok();

    socket.on(
        "message",
        |socket: SocketRef, Data::<Value>(data), Bin(bin)| {
            info!("Received event: {:?} {:?}", data, bin);
            socket.bin(bin).emit("message-back", data).ok();
        },
    );

    socket.on(
        "message-with-ack",
        |Data::<Value>(data), ack: AckSender, Bin(bin)| {
            info!("Received event: {:?} {:?}", data, bin);
            ack.bin(bin).send(data).ok();
        },
    );
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing::subscriber::set_global_default(FmtSubscriber::default())?;

    let config = read_config().await;
    let port = config.port;

    let (layer, io) = SocketIo::new_layer();

    io.ns("/", on_connect);
    io.ns("/custom", on_connect);

    let app = Router::new()
    .route("/", get(|| file_handler("index.html".to_string())))
    .route("/*file_path", get(|Path(file_path): Path<String>| file_handler(file_path)))
    .layer(layer);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    println!("Starting server on port {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await.unwrap();

    Ok(())
}

async fn file_handler(file_path: String) -> impl IntoResponse {
    let path = PathBuf::from(format!("src/public/{}", file_path));
    match File::open(&path).await {
        Ok(mut file) => {
            let mut contents = Vec::new();
            file.read_to_end(&mut contents).await.unwrap();
            let mime_type = from_path(&path).first_or_octet_stream().to_string();
            (axum::http::StatusCode::OK, [(axum::http::header::CONTENT_TYPE, mime_type)], contents)
        }
        Err(_) => (
            axum::http::StatusCode::NOT_FOUND,
            [(axum::http::header::CONTENT_TYPE, "text/plain".to_string())],
            "404: Not Found".to_string().into_bytes(),
        ),
    }
}