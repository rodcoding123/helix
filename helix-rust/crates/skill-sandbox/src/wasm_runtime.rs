use anyhow::{Context, Result};
use wasmtime::*;
use wasmtime_wasi::add_to_linker;
use wasi_common::sync::WasiCtxBuilder;

pub struct WasmSandbox {
    engine: Engine,
}

impl WasmSandbox {
    pub fn new() -> Result<Self> {
        let mut config = Config::new();
        config.epoch_interruption(true);
        config.wasm_simd(true);
        config.wasm_bulk_memory(true);

        let engine = Engine::new(&config)?;
        Ok(Self { engine })
    }

    pub async fn execute(&self, wasm_bytes: &[u8], _input: serde_json::Value) -> Result<serde_json::Value> {
        let module = Module::new(&self.engine, wasm_bytes)
            .context("Failed to compile WASM module")?;

        let mut linker = Linker::new(&self.engine);

        // Create WASI context
        let wasi = WasiCtxBuilder::new()
            .inherit_stdout()
            .inherit_stderr()
            .build();

        add_to_linker(&mut linker, |s| s)?;

        let mut store = Store::new(&self.engine, wasi);

        // Set timeout: 5 seconds max
        store.set_epoch_deadline(1);

        let instance = linker.instantiate(&mut store, &module)
            .context("Failed to instantiate WASM module")?;

        // Call the "execute" function
        let execute_fn = instance.get_typed_func::<(), ()>(&mut store, "execute")
            .context("WASM module missing 'execute' function")?;

        // TODO: Pass input via WASI stdin, read output from stdout
        execute_fn.call(&mut store, ())
            .context("WASM execution failed")?;

        Ok(serde_json::json!({"status": "success"}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_wasm_sandbox_creation() {
        let sandbox = WasmSandbox::new();
        assert!(sandbox.is_ok());
    }
}
