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

export interface LongPause {
  start: number;
  end: number;
  duration: number;
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
  gesture_advice?: string;
  tone_score?: number;
}

export interface ConfidenceIndex {
  total: number;
  components: ConfidenceComponents;
}

export interface StandardCriterionScore {
  criterion_name: string;
  criterion_description: string;
  criterion_current_value: number;
  criterion_max_value: number;
  criterion_feetback: string;
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
  long_pauses?: LongPause[];
  dynamic_fillers?: string[];
  confidence_index: ConfidenceIndex;
  summary: string;
  structure: string;
  mistakes: string;
  ideal_text: string;
  persona_feedback?: string | null;
  presentation_summary?: string;
  standard_criteria_result?: number;
  standard_criteria_max?: number;
  standard_criteria_scores?: StandardCriterionScore[];
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
