export type UserDashboardView = "home" | "my-submissions" | "submit-feedback";

export type CreateSubmissionStep = "form" | "confirm" | "success";

export type HoverFilterKey =
  | "tracking"
  | "date"
  | "type"
  | "category"
  | "priority"
  | "status";

export const FEEDBACK_MESSAGE_MAX_LENGTH = 250;
export const FEEDBACK_SUBJECT_MAX_LENGTH = 50;
export const CONVERSATION_MESSAGE_MAX_LENGTH = 2000;

export const USER_MESSAGE_BUBBLE_CLASS =
  "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm text-white shadow-sm";

export const MY_SUBMISSIONS_PAGE_SIZE_OPTIONS = [10, 30, 50, 100] as const;

export const SUBMISSION_FILTER_TEXT_COLOR = "#171717";

export const SUBMISSION_FILTER_CONTROL_CLASS =
  "!h-9 min-h-9 w-full rounded-[12px] border border-[#eceae5] bg-muted/50 px-4 text-[14px] font-semibold text-[#171717] shadow-none transition-colors focus-visible:border-[#e0ddd6] focus-visible:ring-0 focus-visible:ring-transparent";

export const USER_FEEDBACK_DRAFT_KEY = "ff:userDashboardDraft";
export const USER_DASHBOARD_SUBMISSIONS_SCROLL_KEY =
  "ff:userDashboardSubmissionsScrollTop";

export const EMPTY_FORM = {
  type: "",
  category: "",
  subject: "",
  message: "",
};

export const SUBMISSION_FIELD_CLASS =
  "h-10 rounded-lg border border-input bg-input-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export const SUBMISSION_ACTION_BUTTON_HEIGHT_CLASS = "h-10";

export const CREATE_SUBMISSION_STEP_ORDER: Record<CreateSubmissionStep, number> = {
  form: 0,
  confirm: 1,
  success: 2,
};
