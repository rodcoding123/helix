use anyhow::{Context, Result};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::probe::Hint;
use symphonia::core::formats::FormatOptions;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::audio::Signal;
use rubato::{Resampler, SincFixedIn};
use std::io::Cursor;

pub struct AudioProcessor {
    target_sample_rate: u32,
}

impl AudioProcessor {
    pub fn new() -> Self {
        Self {
            target_sample_rate: 16000, // Deepgram optimal
        }
    }

    pub fn process_audio(&self, input_bytes: &[u8], _format_hint: &str) -> Result<Vec<i16>> {
        // Simple approach: convert raw audio to PCM for common formats
        // For Deepgram, we assume webm/opus input and do basic normalization

        // Start with input as raw mono PCM estimate
        let mut samples: Vec<f32> = Vec::new();

        // Try to interpret input as 16-bit PCM audio
        for chunk in input_bytes.chunks_exact(2) {
            if chunk.len() == 2 {
                let sample_i16 = i16::from_le_bytes([chunk[0], chunk[1]]);
                let sample_f32 = sample_i16 as f32 / 32768.0;
                samples.push(sample_f32.clamp(-1.0, 1.0));
            }
        }

        // If not enough samples, try interpreting as raw bytes
        if samples.is_empty() {
            for &byte in input_bytes {
                let sample_f32 = (byte as f32 / 128.0) - 1.0;
                samples.push(sample_f32.clamp(-1.0, 1.0));
            }
        }

        // Assume source is 48kHz (common for webm)
        let source_rate = 48000u32;

        // 2. Resample to 16kHz if needed
        let resampled = if source_rate != self.target_sample_rate && !samples.is_empty() {
            self.resample(&samples, source_rate, self.target_sample_rate)?
        } else {
            samples
        };

        // 3. Convert to 16-bit PCM
        let pcm: Vec<i16> = resampled.iter()
            .map(|&s: &f32| (s * 32767.0).clamp(-32768.0, 32767.0) as i16)
            .collect();

        Ok(pcm)
    }

    fn resample(&self, input: &[f32], from_rate: u32, to_rate: u32) -> Result<Vec<f32>> {
        if input.is_empty() {
            return Ok(Vec::new());
        }

        let ratio = to_rate as f64 / from_rate as f64;

        let params = rubato::SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            oversampling_factor: 256,
            interpolation: rubato::SincInterpolationType::Linear,
            window: rubato::WindowFunction::BlackmanHarris2,
        };

        let mut resampler = SincFixedIn::<f32>::new(
            ratio,
            2.0,
            params,
            input.len(),
            1,
        )?;

        let output = resampler.process(&[input], None)?;
        Ok(output[0].clone())
    }

    pub fn to_wav_bytes(&self, pcm: &[i16]) -> Result<Vec<u8>> {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: self.target_sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut cursor = Cursor::new(Vec::new());
        let mut writer = hound::WavWriter::new(&mut cursor, spec)?;

        for &sample in pcm {
            writer.write_sample(sample)?;
        }

        writer.finalize()?;
        Ok(cursor.into_inner())
    }
}
