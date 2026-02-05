/**
 * Voice Recorder Component Tests
 * Week 5 Track 5: Voice Recording UI - Task 5.1
 * 15+ tests for voice recording functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { VoiceRecorder } from '../components/voice/VoiceRecorder';

describe('Voice Recorder', () => {
  // Create a mock MediaRecorder class
  class MockMediaRecorder {
    ondataavailable: ((event: any) => void) | null = null;
    onstop: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    state: 'inactive' | 'recording' | 'paused' = 'inactive';

    constructor(stream: MediaStream, options?: any) {
      this.stream = stream;
      this.options = options;
    }

    start(): void {
      this.state = 'recording';
    }

    stop(): void {
      this.state = 'inactive';
      // Simulate onstop callback
      if (this.onstop) {
        this.onstop(new Event('stop'));
      }
    }

    pause(): void {
      this.state = 'paused';
    }

    resume(): void {
      this.state = 'recording';
    }

    static isTypeSupported(type: string): boolean {
      return type === 'audio/webm;codecs=opus' || type === 'audio/wav';
    }
  }

  // Create a mock MediaStream
  const createMockMediaStream = (): MediaStream => {
    return {
      getTracks: vi.fn().mockReturnValue([
        {
          stop: vi.fn(),
          kind: 'audio',
          enabled: true,
        },
      ]),
      getAudioTracks: vi.fn().mockReturnValue([]),
      getVideoTracks: vi.fn().mockReturnValue([]),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as any;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock MediaRecorder globally
    (global as any).MediaRecorder = MockMediaRecorder;

    // Mock navigator.mediaDevices.getUserMedia
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(createMockMediaStream()),
      },
      writable: true,
    });
  });

  describe('useVoiceRecorder Hook', () => {
    it('initializes with correct default state', () => {
      const { result } = renderHook(() => useVoiceRecorder());

      expect(result.current.isRecording).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.duration).toBe(0);
      expect(result.current.audioBlob).toBeUndefined();
    });

    it('starts recording when startRecording is called', async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);
    });

    it('stops recording when stopRecording is called', async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);

      await act(async () => {
        result.current.stopRecording();
        // Wait a tick for the onstop callback to fire
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isRecording).toBe(false);
    });

    it('pauses recording', async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isPaused).toBe(false);

      await act(async () => {
        result.current.pauseRecording();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isPaused).toBe(true);
    });

    it('resumes recording', async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      await act(async () => {
        result.current.pauseRecording();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isPaused).toBe(true);

      await act(async () => {
        result.current.resumeRecording();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isPaused).toBe(false);
    });

    it('formats duration correctly', () => {
      const { result } = renderHook(() => useVoiceRecorder());

      expect(result.current.formatDuration(0)).toBe('00:00');
      expect(result.current.formatDuration(5)).toBe('00:05');
      expect(result.current.formatDuration(60)).toBe('01:00');
      expect(result.current.formatDuration(125)).toBe('02:05');
      expect(result.current.formatDuration(3661)).toBe('61:01');
    });

    it('gets waveform data', () => {
      const { result } = renderHook(() => useVoiceRecorder());

      const waveform = result.current.getWaveformData();
      expect(Array.isArray(waveform)).toBe(true);
      expect(waveform.length).toBe(32);
      expect(waveform.every(v => v >= 0 && v <= 1)).toBe(true);
    });

    it('resets recording state', async () => {
      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.isRecording).toBe(true);

      await act(async () => {
        result.current.reset();
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.duration).toBe(0);
    });


    it('handles missing microphone permission error', async () => {
      global.navigator.mediaDevices.getUserMedia = vi
        .fn()
        .mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));

      const { result } = renderHook(() => useVoiceRecorder());

      await act(async () => {
        await result.current.startRecording();
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error).toContain('Failed to start recording');
    });
  });

  describe('VoiceRecorder Component', () => {
    it('renders voice recorder interface', () => {
      const { getByText } = render(<VoiceRecorder />);

      expect(getByText('Voice Recording')).toBeTruthy();
      expect(getByText('Start Recording')).toBeTruthy();
    });

    it('displays duration timer', async () => {
      const { getByText } = render(<VoiceRecorder />);

      const startButton = getByText('Start Recording');

      await act(async () => {
        fireEvent.click(startButton);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const durationDisplay = getByText('00:00');
      expect(durationDisplay).toBeTruthy();
    });

    it('shows pause button during recording', async () => {
      const { getByText } = render(<VoiceRecorder />);

      const startButton = getByText('Start Recording');

      await act(async () => {
        fireEvent.click(startButton);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(getByText('Pause')).toBeTruthy();
    });

    it('calls onClose when close button is clicked', () => {
      const mockOnClose = vi.fn();
      const { getByText } = render(<VoiceRecorder onClose={mockOnClose} />);

      const closeButton = getByText('✕');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('displays error messages', async () => {
      global.navigator.mediaDevices.getUserMedia = vi
        .fn()
        .mockRejectedValue(new Error('Mic not available'));

      const { getByText } = render(<VoiceRecorder />);

      const startButton = getByText('Start Recording');

      await act(async () => {
        fireEvent.click(startButton);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      await waitFor(() => {
        expect(getByText(/Failed to start recording/)).toBeTruthy();
      });
    });
  });
});
