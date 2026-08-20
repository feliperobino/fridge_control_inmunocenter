import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import {
  createReportSchedule,
  deleteReportSchedule,
  listReportSchedules,
  updateReportSchedule
} from '../api/reportSchedules.js';

const initialForm = {
  name: '',
  cronExpression: '0 8 * * *',
  format: 'CSV',
  fridgeIds: [],
  recipients: '',
  active: true
};

function splitRecipients(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ReportsPage() {
  const [fridges, setFridges] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);

      try {
        const [fridgesData, schedulesData] = await Promise.all([apiRequest('/fridges'), listReportSchedules()]);

        if (!isMounted) {
          return;
        }

        setFridges(Array.isArray(fridgesData) ? fridgesData : []);
        setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError?.data?.error || 'No se pudo cargar la página de reportes');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  function resetForm() {
    setForm(initialForm);
    setEditingId('');
  }

  function startEditing(schedule) {
    setEditingId(schedule.id);
    setForm({
      name: schedule.name,
      cronExpression: schedule.cronExpression,
      format: schedule.format,
      fridgeIds: schedule.fridgeIds || [],
      recipients: schedule.recipients?.join(', ') || '',
      active: Boolean(schedule.active)
    });
  }

  async function refreshSchedules() {
    const schedulesData = await listReportSchedules();
    setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const payload = {
      name: form.name.trim(),
      cronExpression: form.cronExpression.trim(),
      format: form.format,
      fridgeIds: form.fridgeIds,
      recipients: splitRecipients(form.recipients),
      active: form.active
    };

    if (!payload.name || !payload.cronExpression || payload.recipients.length === 0) {
      setError('Completá nombre, cron y destinatarios.');
      return;
    }

    try {
      if (editingId) {
        await updateReportSchedule(editingId, payload);
        setSuccess('Schedule actualizado.');
      } else {
        await createReportSchedule(payload);
        setSuccess('Schedule creado.');
      }

      await refreshSchedules();
      resetForm();
    } catch (submitError) {
      setError(submitError?.data?.error || 'No se pudo guardar el schedule');
    }
  }

  async function handleDelete(scheduleId) {
    await deleteReportSchedule(scheduleId);
    await refreshSchedules();
    if (editingId === scheduleId) {
      resetForm();
    }
  }

  return (
    <section className="page-stack">
      <div className="page-heading">
        <span className="brand-kicker">Reportes</span>
        <h2>Schedules programados</h2>
        <p>Administrá los cron jobs que generan y envían reportes por email.</p>
      </div>

      {isLoading ? <div className="route-state">Cargando schedules...</div> : null}
      {error ? <div className="state-card state-error">{error}</div> : null}
      {success ? <div className="state-card">{success}</div> : null}

      {!isLoading ? (
        <div className="admin-layout">
          <div className="card-shell">
            <div className="section-heading">
              <div>
                <span className="brand-kicker">Formulario</span>
                <h3>{editingId ? 'Editar schedule' : 'Crear schedule'}</h3>
              </div>
            </div>

            <form className="admin-form" onSubmit={handleSubmit}>
              <label>
                Nombre
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>

              <label>
                Cron expression
                <input
                  type="text"
                  value={form.cronExpression}
                  onChange={(event) => setForm((current) => ({ ...current, cronExpression: event.target.value }))}
                  placeholder="0 8 * * *"
                  required
                />
              </label>

              <div className="admin-grid">
                <label>
                  Formato
                  <select
                    value={form.format}
                    onChange={(event) => setForm((current) => ({ ...current, format: event.target.value }))}
                  >
                    <option value="CSV">CSV</option>
                    <option value="XLSX">Excel</option>
                    <option value="PDF">PDF</option>
                  </select>
                </label>

                <label>
                  Destinatarios
                  <input
                    type="text"
                    value={form.recipients}
                    onChange={(event) => setForm((current) => ({ ...current, recipients: event.target.value }))}
                    placeholder="ops@example.com, qa@example.com"
                    required
                  />
                </label>
              </div>

              <label>
                Refrigeradores
                <select
                  multiple
                  value={form.fridgeIds}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      fridgeIds: Array.from(event.target.selectedOptions, (option) => option.value)
                    }))
                  }
                >
                  {fridges.map((fridge) => (
                    <option key={fridge.id} value={fridge.id}>
                      {fridge.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                />
                Activo
              </label>

              <div className="button-row">
                <button className="button button-primary" type="submit">
                  {editingId ? 'Guardar cambios' : 'Crear schedule'}
                </button>
                {editingId ? (
                  <button className="button button-secondary" type="button" onClick={resetForm}>
                    Cancelar edición
                  </button>
                ) : null}
              </div>
            </form>
          </div>

          <div className="card-shell">
            <div className="section-heading">
              <div>
                <span className="brand-kicker">Listado</span>
                <h3>Schedules activos e inactivos</h3>
              </div>
            </div>

            <div className="admin-table">
              {schedules.length > 0 ? (
                schedules.map((schedule) => (
                  <article key={schedule.id} className="admin-table-row">
                    <div>
                      <strong>{schedule.name}</strong>
                      <small>
                        {schedule.cronExpression} · {schedule.format} · {schedule.active ? 'Activo' : 'Inactivo'}
                      </small>
                      <small>{schedule.recipients?.join(', ')}</small>
                    </div>

                    <div className="button-row">
                      <button className="button button-secondary" type="button" onClick={() => startEditing(schedule)}>
                        Editar
                      </button>
                      <button className="button button-secondary" type="button" onClick={() => handleDelete(schedule.id)}>
                        Borrar
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">No hay schedules creados todavía.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}