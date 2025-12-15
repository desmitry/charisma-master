export type ProcessingState = "queued" | "processing" | "finished" | "failed";
export type ProcessingStage = "listening" | "gestures" | "analyzing";

export interface TranscriptWord {
  start: number;
  end: number;
  text: string;
  is_filler?: boolean;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words: TranscriptWord[];
}

export interface TempoPoint {
  time: number;
  wpm: number;
  zone: string;
}

export interface ConfidenceComponents {
  volume_score: number;
  filler_score: number;
  gaze_score: number;
  gesture_score?: number;
  tone_score?: number;
}

export interface ConfidenceIndex {
  total: number;
  components: ConfidenceComponents;
}

export interface AnalysisResult {
  task_id: string;
  video_path: string;
  transcript: TranscriptSegment[];
  tempo: TempoPoint[];
  fillers_summary: {
    count: number;
    ratio: number;
  };
  confidence_index: ConfidenceIndex;
  summary: string;
  structure: string;
  mistakes: string;
  ideal_text: string;
  persona_feedback?: string | null;
  slide_text_density: number;
  analyze_provider?: string;
  analyze_model?: string;
  raw_metrics?: {
    gaze_score?: number;
    gesture_score?: number;
    raw_movement?: number;
    volume_score?: number;
    tone_score?: number;
    pitch_std?: number;
  };
}

export interface TaskStatusResponse {
  state: ProcessingState;
  stage?: string | null;
  progress?: number;
  error?: string | null;
  task_id: string;
}

