"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ApiError, sendContactMessage } from "@/lib/api";
import { DemoFormNotice } from "@/components/site/demo-banner";
import { fieldClass, primaryButtonClass } from "@/lib/styles";

const field = fieldClass;

/*--The contact form: sends the message to the backend (POST /api/v1/contact)--*/
export default function ContactForm() {
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    setSending(true);
    setErrors({});
    try {
      await sendContactMessage({
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: data.message,
        website: data.website,
      });
      toast.success(
        "Thank you! Your message has been sent. We will contact you as soon as possible.",
      );
      form.reset();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.data &&
        typeof error.data === "object"
      )
        setErrors(error.data as Record<string, string>);
      toast.error(
        error instanceof Error
          ? error.message
          : "Your message could not be sent. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <DemoFormNotice />
      <div>
        <label htmlFor="contact-name" className="sr-only">
          Your Name
        </label>
        <input
          id="contact-name"
          name="name"
          required
          maxLength={100}
          placeholder="Your Name"
          className={field}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name}</p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-email" className="sr-only">
            Your Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            maxLength={150}
            placeholder="Your Email"
            className={field}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email}</p>
          )}
        </div>
        <div>
          <label htmlFor="contact-phone" className="sr-only">
            Phone Number
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            maxLength={30}
            placeholder="Phone Number"
            className={field}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="contact-message" className="sr-only">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={5000}
          placeholder="Message"
          className={field}
          aria-invalid={!!errors.message}
        />
        {errors.message && (
          <p className="mt-1 text-xs text-red-600">{errors.message}</p>
        )}
      </div>
      {/* Spam trap: people never see or fill this field */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <div>
        <button
          type="submit"
          disabled={sending}
          className={`w-full sm:w-auto ${primaryButtonClass}`}
        >
          {sending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
