export type ProcessingState = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILURE";
export type TaskStage = [string, number, string];

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
	volume_level: string;
	volume_score: number;
	volume_label: string;
	filler_score: number;
	filler_label: string;
	gaze_score: number;
	gaze_label: string;
	gesture_score: number;
	gesture_label: string;
	gesture_advice: string;
	tone_score: number;
	tone_label: string;
}

export interface ConfidenceIndex {
	total: number;
	total_label: string;
	components: ConfidenceComponents;
}

export interface EvaluationCriterion {
	name: string;
	description: string;
	max_value: number;
	current_value?: number;
	feedback?: string;
}

export interface EvaluationCriteriaReport {
	total_score: number;
	max_score: number;
	criteria: EvaluationCriterion[];
}

export interface SpeechReport {
	summary: string;
	structure: string;
	mistakes: string;
	ideal_text: string;
	persona_feedback: string;
	dynamic_fillers: string[];
	presentation_feedback: string;
	useful_links: string[];
}

export interface AnalysisResult {
	task_id: string;
	video_path: string | null;
	user_need_video_analysis: boolean;
	user_need_text_from_video: boolean;
	transcript: TranscriptSegment[];
	tempo: TempoPoint[];
	fillers_summary: {
		count: number;
		ratio: number;
	};
	long_pauses: LongPause[];
	confidence_index: ConfidenceIndex;
	speech_report: SpeechReport;
	evaluation_criteria_report: EvaluationCriteriaReport;
	analyze_provider: string;
	analyze_model: string;
	transcribe_model: string;
}

export interface TaskStatusResponse {
	state: ProcessingState;
	hint: string;
	stage?: TaskStage | null;
	progress?: number;
	error?: string | null;
	task_id: string;
}
