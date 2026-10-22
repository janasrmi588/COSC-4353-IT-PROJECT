import { useEffect, useState } from "react";
import {
  createService,
  deleteService,
  fetchServices,
  updateService,
} from "../../data/servicesApi";
import { getStoredUser } from "../../data/useNotifications";
import {
  DESCRIPTION_MAX_LENGTH,
  EMPTY_SERVICE_FORM,
  NAME_MAX_LENGTH,
  PRIORITY_LABELS,
  PRIORITY_LEVELS,
  validateService,
} from "../../data/serviceHelpers";
import styles from "./ServiceManagement.module.css";

function ServiceManagement() {
  const [serviceList, setServiceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_SERVICE_FORM);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const errors = validateService(form);
  const showError = (field) => (submitted || touched[field]) && errors[field];

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    let ignore = false;

    async function loadServices() {
      const result = await fetchServices();
      if (ignore) return;

      if (result.ok) {
        setServiceList(result.services);
      } else {
        setLoadError(result.message);
      }
      setLoading(false);
    }

    loadServices();

    return () => {
      ignore = true;
    };
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_SERVICE_FORM);
    setTouched({});
    setSubmitted(false);
    setSaveError("");
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleBlur(event) {
    const { name } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  function startEdit(service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description,
      expectedDuration: String(service.expectedDuration),
      priority: service.priority,
    });
    setTouched({});
    setSubmitted(false);
    setSaveError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    setSaveError("");
    if (Object.keys(errors).length > 0) return;

    const values = {
      name: form.name.trim(),
      description: form.description.trim(),
      expectedDuration: Number(form.expectedDuration),
      priority: form.priority,
    };

    const adminEmail = getStoredUser()?.email;

    setSaving(true);
    const result =
      editingId === null
        ? await createService(adminEmail, values)
        : await updateService(adminEmail, editingId, values);
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.message);
      return;
    }

    if (editingId === null) {
      setServiceList((prev) => [...prev, result.service]);
      setMessage(`Created ${result.service.name}.`);
    } else {
      setServiceList((prev) =>
        prev.map((s) => (s.id === result.service.id ? result.service : s)),
      );
      setMessage(`Saved changes to ${result.service.name}.`);
    }
    resetForm();
  }

  async function handleDelete(service) {
    const confirmed = window.confirm(
      `Delete "${service.name}"? This can't be undone.`,
    );
    if (!confirmed) return;

    setSaveError("");
    setSaving(true);
    const result = await deleteService(getStoredUser()?.email, service.id);
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.message);
      return;
    }

    setServiceList((prev) => prev.filter((s) => s.id !== service.id));
    if (editingId === service.id) {
      resetForm();
    }
    setMessage(`Deleted ${service.name}.`);
  }

  const isEditing = editingId !== null;

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Service Management</h1>
          <p className={styles.subtitle}>
            Create and edit the services students and faculty can request help
            with. Each service&apos;s expected duration feeds the wait-time
            estimates shown in the queue.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={resetForm}
        >
          New service
        </button>
      </div>

      {message && (
        <p className={styles.banner} role="status">
          {message}
        </p>
      )}

      {(loadError || saveError) && (
        <p className={styles.error} role="alert">
          {loadError || saveError}
        </p>
      )}

      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="service-list-title">
          <div className={styles.panelHeader}>
            <h2 id="service-list-title" className={styles.panelTitle}>
              Services
            </h2>
            <span className={styles.count}>
              {serviceList.length}{" "}
              {serviceList.length === 1 ? "service" : "services"}
            </span>
          </div>

          <ul className={styles.list}>
            {loading && <li className={styles.row}>Loading services...</li>}
            {!loading && !loadError && serviceList.length === 0 && (
              <li className={styles.row}>No services yet.</li>
            )}
            {serviceList.map((service) => {
              const selected = service.id === editingId;
              return (
                <li
                  key={service.id}
                  className={`${styles.row} ${selected ? styles.rowSelected : ""}`}
                >
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{service.name}</div>
                    <div className={styles.rowDescription}>
                      {service.description}
                    </div>
                  </div>
                  <div className={styles.rowMeta}>
                    <span className={styles.duration}>
                      {service.expectedDuration} min
                    </span>
                    <span
                      className={`${styles.badge} ${styles[`badge_${service.priority}`]}`}
                    >
                      {PRIORITY_LABELS[service.priority]}
                    </span>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => startEdit(service)}
                      aria-label={`${selected ? "Currently editing" : "Edit"} ${service.name}`}
                    >
                      {selected ? "Editing" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => handleDelete(service)}
                      disabled={saving}
                      aria-label={`Delete ${service.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.panel} aria-labelledby="service-form-title">
          <h2
            id="service-form-title"
            className={`${styles.panelTitle} ${styles.formTitle}`}
          >
            {isEditing ? "Edit service" : "New service"}
          </h2>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="service-name" className={styles.label}>
                  Service name
                </label>
                <span className={styles.required}>Required</span>
              </div>
              <input
                id="service-name"
                name="name"
                type="text"
                className={`${styles.input} ${showError("name") ? styles.inputError : ""}`}
                value={form.name}
                maxLength={NAME_MAX_LENGTH}
                autoComplete="off"
                onChange={handleChange}
                onBlur={handleBlur}
                aria-invalid={Boolean(showError("name"))}
                aria-describedby="service-name-feedback"
              />
              <div id="service-name-feedback" className={styles.feedbackRow}>
                {showError("name") && (
                  <span className={styles.error}>{errors.name}</span>
                )}
                <span className={styles.counter}>
                  {form.name.length} / {NAME_MAX_LENGTH}
                </span>
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="service-description" className={styles.label}>
                  Description
                </label>
                <span className={styles.required}>Required</span>
              </div>
              <textarea
                id="service-description"
                name="description"
                rows={4}
                className={`${styles.input} ${styles.textarea} ${
                  showError("description") ? styles.inputError : ""
                }`}
                value={form.description}
                maxLength={DESCRIPTION_MAX_LENGTH}
                onChange={handleChange}
                onBlur={handleBlur}
                aria-invalid={Boolean(showError("description"))}
                aria-describedby="service-description-feedback"
              />
              <div id="service-description-feedback">
                {showError("description") && (
                  <span className={styles.error}>{errors.description}</span>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label htmlFor="service-duration" className={styles.label}>
                  Expected duration
                </label>
                <span className={styles.required}>Required</span>
              </div>
              <div className={styles.durationRow}>
                <input
                  id="service-duration"
                  name="expectedDuration"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  className={`${styles.input} ${styles.durationInput} ${
                    showError("expectedDuration") ? styles.inputError : ""
                  }`}
                  value={form.expectedDuration}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(showError("expectedDuration"))}
                  aria-describedby="service-duration-feedback"
                />
                <span className={styles.unit}>minutes</span>
              </div>
              <div id="service-duration-feedback">
                {showError("expectedDuration") && (
                  <span className={styles.error}>
                    {errors.expectedDuration}
                  </span>
                )}
              </div>
              <p className={styles.hint}>
                Used to estimate wait times for users in the queue.
              </p>
            </div>

            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>Priority level</legend>
              <div className={styles.priorityGroup}>
                {PRIORITY_LEVELS.map((level) => (
                  <label key={level} className={styles.priorityOption}>
                    <input
                      type="radio"
                      name="priority"
                      value={level}
                      checked={form.priority === level}
                      onChange={handleChange}
                    />
                    <span className={styles.priorityText}>
                      {PRIORITY_LABELS[level]}
                    </span>
                  </label>
                ))}
              </div>
              <p className={styles.hint}>
                Default priority for tickets submitted under this service.
              </p>
            </fieldset>

            <div className={styles.actions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={saving}
              >
                {isEditing ? "Save changes" : "Create service"}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={resetForm}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default ServiceManagement;
