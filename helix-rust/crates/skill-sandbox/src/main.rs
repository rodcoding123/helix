use anyhow::Result;
use clap::Parser;
use tracing_subscriber;

mod wasm_runtime;
mod rpc_server;

use rpc_server::start_rpc_server;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Port for RPC server
    #[arg(short, long, default_value_t = 18790)]
    port: u16,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    let args = Args::parse();

    start_rpc_server(args.port).await?;
    Ok(())
}
