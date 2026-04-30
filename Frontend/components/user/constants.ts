// Types
export type UserDashboardView = "home" | "my-submissions" | "submit-feedback";
export type CreateSubmissionStep = "form" | "confirm" | "success";
export type HoverFilterKey =
  | "tracking"
  | "date"
  | "type"
  | "category"
  | "priority"
  | "status";

// Step ordering
export const CREATE_SUBMISSION_STEP_ORDER: Record<CreateSubmissionStep, number> =
  {
    form: 0,
    confirm: 1,
    success: 2,
  };

// Form constraints
export const FEEDBACK_MESSAGE_MAX_LENGTH = 250;
export const FEEDBACK_SUBJECT_MAX_LENGTH = 50;
export const CONVERSATION_MESSAGE_MAX_LENGTH = 2000;

// Styling
export const USER_MESSAGE_BUBBLE_CLASS =
  "border border-[#E0A400] bg-[#F4B000] text-white";
export const SUBMISSION_FILTER_TEXT_COLOR = "#171717";
export const SUBMISSION_FILTER_CONTROL_CLASS =
  "!h-9 min-h-9 w-full rounded-[12px] border border-[#eceae5] bg-muted/50 px-4 text-[14px] font-semibold text-[#171717] shadow-none transition-colors focus-visible:border-[#e0ddd6] focus-visible:ring-0 focus-visible:ring-transparent";
export const SUBMISSION_FIELD_CLASS =
  "h-10 rounded-lg border-border/70 bg-background focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-200/60";
export const SUBMISSION_ACTION_BUTTON_HEIGHT_CLASS = "h-9";

// Pagination
export const MY_SUBMISSIONS_PAGE_SIZE_OPTIONS = [10, 30, 50, 100] as const;

// Local storage keys
export const USER_FEEDBACK_DRAFT_KEY = "userFeedbackDraft";
export const USER_DASHBOARD_SUBMISSIONS_SCROLL_KEY =
  "userDashboardSubmissionsScrollTop";

// Empty form state
export const EMPTY_FORM = {
  type: "",
  category: "",
  priority: "",
  subject: "",
  message: "",
};