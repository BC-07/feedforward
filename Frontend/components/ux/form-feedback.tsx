"use client";

export function RequiredMark() {
  return <span className="ff-required">*</span>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="ff-field-error">{message}</p>;
}

export function FieldHint({ message }: { message: string }) {
  return <p className="ff-field-hint">{message}</p>;
}

