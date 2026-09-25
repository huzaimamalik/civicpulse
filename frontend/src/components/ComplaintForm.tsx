import { useRef, useState, type FormEvent } from "react";
import type { SubmitComplaintInput } from "../types/complaint";
import { Icon } from "./Icon";

export function ComplaintForm({
  onSubmit,
}: {
  onSubmit: (input: SubmitComplaintInput) => void;
}) {
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [errors, setErrors] = useState<{ text?: string; location?: string }>(
    {},
  );
  const textRef = useRef<HTMLTextAreaElement>(null);
  const locationRef = useRef<HTMLInputElement>(null);
  const characterCount = Array.from(text).length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    const locationLength = Array.from(location).length;
    if (characterCount < 10 || characterCount > 2000)
      nextErrors.text = "Enter a complaint between 10 and 2000 characters.";
    if (locationLength < 3 || locationLength > 200)
      nextErrors.location = "Enter a location between 3 and 200 characters.";
    setErrors(nextErrors);
    if (nextErrors.text) textRef.current?.focus();
    else if (nextErrors.location) locationRef.current?.focus();
    else onSubmit({ text, location, reporter_contact: contact || null });
  }

  return (
    <form className="card form-card" noValidate onSubmit={submit}>
      <div className="field">
        <div className="field-heading">
          <label htmlFor="complaint-text">
            Describe the issue
            <span className="required" aria-hidden="true">
              *
            </span>
          </label>
          <span id="text-count" className="counter">
            {characterCount} / 2000
          </span>
        </div>
        <p className="field-hint" id="text-hint">
          Describe what happened, when you noticed it, and any immediate risk.
        </p>
        <textarea
          ref={textRef}
          id="complaint-text"
          name="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="For example, a water pipe has burst near Street 12 and water is entering nearby houses."
          required
          aria-invalid={!!errors.text}
          aria-describedby={`text-hint text-count${errors.text ? " text-error" : ""}`}
        />
        {errors.text && (
          <p id="text-error" className="field-error" role="alert">
            {errors.text}
          </p>
        )}
      </div>
      <div className="field">
        <div className="field-heading">
          <label htmlFor="complaint-location">
            Location
            <span className="required" aria-hidden="true">
              *
            </span>
          </label>
        </div>
        <p className="field-hint" id="location-hint">
          Include a street, area, or nearby landmark.
        </p>
        <input
          ref={locationRef}
          id="complaint-location"
          name="location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Street 12, G-10/2, Islamabad"
          required
          aria-invalid={!!errors.location}
          aria-describedby={`location-hint${errors.location ? " location-error" : ""}`}
        />
        {errors.location && (
          <p id="location-error" className="field-error" role="alert">
            {errors.location}
          </p>
        )}
      </div>
      <div className="field">
        <div className="field-heading">
          <label htmlFor="reporter-contact">Contact information</label>
          <span className="optional">Optional</span>
        </div>
        <p className="field-hint" id="contact-hint">
          You can include a phone number or email address with your report.
        </p>
        <input
          id="reporter-contact"
          name="reporter_contact"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="Phone number or email address"
          aria-describedby="contact-hint"
        />
      </div>
      <button className="button" type="submit">
        Submit Complaint
        <Icon name="arrow" />
      </button>
      <p className="form-footnote">
        Fields marked <span className="required">*</span> are required.
      </p>
    </form>
  );
}
