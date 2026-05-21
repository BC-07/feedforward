-- Add foreign keys + indexes for relationships

-- Indexes to speed joins
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON public.feedbacks (user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_category ON public.feedbacks (category);
CREATE INDEX IF NOT EXISTS idx_admins_unit ON public.admins (unit);

-- Foreign keys
ALTER TABLE public.feedbacks
  DROP CONSTRAINT IF EXISTS fk_feedbacks_user_id;
ALTER TABLE public.feedbacks
  ADD CONSTRAINT fk_feedbacks_user_id
  FOREIGN KEY (user_id)
  REFERENCES public.users (id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

ALTER TABLE public.feedbacks
  DROP CONSTRAINT IF EXISTS fk_feedbacks_category;
ALTER TABLE public.feedbacks
  ADD CONSTRAINT fk_feedbacks_category
  FOREIGN KEY (category)
  REFERENCES public.categories (name)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

ALTER TABLE public.admins
  DROP CONSTRAINT IF EXISTS fk_admins_unit;
ALTER TABLE public.admins
  ADD CONSTRAINT fk_admins_unit
  FOREIGN KEY (unit)
  REFERENCES public.categories (name)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;
