-- Add feedback message thread table

CREATE TABLE IF NOT EXISTS public.feedback_messages (
  id VARCHAR(64) PRIMARY KEY,
  feedback_id VARCHAR(64) NOT NULL,
  sender_role VARCHAR(20) NOT NULL,
  sender_id VARCHAR(64),
  sender_name VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_feedback_id ON public.feedback_messages (feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_created_at ON public.feedback_messages (created_at);

ALTER TABLE public.feedback_messages
  DROP CONSTRAINT IF EXISTS fk_feedback_messages_feedback_id;
ALTER TABLE public.feedback_messages
  ADD CONSTRAINT fk_feedback_messages_feedback_id
  FOREIGN KEY (feedback_id)
  REFERENCES public.feedbacks (id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;
