import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';
import {
  createReportSchedule,
  deleteReportSchedule,
  listReportSchedules,
  updateReportSchedule
} from '../api/reportSchedules.js';

const DAYS_OF_WEEK = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' }
];

const initialForm = {
  name: '',
  frequencyType: 'DAILY', // 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
  time: '08:00',
  dayOfWeek: '1',
  dayOfMonth: '1',
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

function buildCronExpression({ frequencyType, time, dayOfWeek, dayOfMonth, cronExpression }) {
  if (frequencyType === 'CUSTOM') return cronExpression;

  const [hourStr, minStr] = (time || '08:00').split(':');
  const hour = parseInt(hourStr, 10) || 0;
  const minute = parseInt(minStr, 10) || 0;

  switch (frequencyType) {
    case 'DAILY':
      return `${minute} ${hour} * * *`;
    case 'WEEKLY':
      return `${minute} ${hour} * * ${dayOfWeek}`;
    case 'MONTHLY':
      return `${minute} ${hour} ${dayOfMonth} * *`;
    default:
      return `${minute} ${hour} * * *`;
  }
}

function describeCron(cron) {
  if (!cron) return 'Sin programación';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [min, hour, dom, mon, dow] = parts;
  const timeStr = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;

  if (dom === '*' && mon === '*' && dow === '*') {
    return `Todos los días a las ${timeStr}`;
  }

  if (dom === '*' && mon === '*' && dow !== '*') {
    const dayObj = DAYS_OF_WEEK.find((d) => d.value === dow);
    const dayName = dayObj ? dayObj.label : `día ${dow}`;
    return `Todos los ${dayName}s a las ${timeStr}`;
  }

  if (dom !== '*' && mon === '*' && dow === '*') {
    return `El día ${dom} de cada mes a las ${timeStr}`;
  }

  return `Personalizado: (${cron})`;
}

function parseCronToForm(cron) {
  if (!cron) return { frequencyType: 'DAILY', time: '08:00', cronExpression: '0 8 * * *' };
  const parts = cron.trim().split(/\s+/);

  if (parts.length === 5) {
    const [min, hour, dom, mon, dow] = parts;
    const timeStr = `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;

    if (dom === '*' && mon === '*' && dow === '*') {
      return { frequencyType: 'DAILY', time: timeStr, cronExpression: cron };
    }
    if (dom === '*' && mon === '*' && dow !== '*') {
      return { frequencyType: 'WEEKLY', time: timeStr, dayOfWeek: dow, cronExpression: cron };
    }
    if (dom !== '*' && mon === '*' && dow === '*') {
      return { frequencyType: 'MONTHLY', time: timeStr, dayOfMonth: dom, cronExpression: cron };
    }
  }

  return { frequencyType: 'CUSTOM', time: '08:00', cronExpression: cron };
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

        if (!isMounted) return;

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
    const parsedCron = parseCronToForm(schedule.cronExpression);

    setForm({
      name: schedule.name,
      format: schedule.format,
      fridgeIds: schedule.fridgeIds || [],
      recipients: schedule.recipients?.join(', ') || '',
      active: Boolean(schedule.active),
      frequencyType: parsedCron.frequencyType,
      time: parsedCron.time || '08:00',
      dayOfWeek: parsedCron.dayOfWeek || '1',
      dayOfMonth: parsedCron.dayOfMonth || '1',
      cronExpression: schedule.cronExpression
    });
  }

  async function refreshSchedules() {
    const schedulesData = await listReportSchedules();
    setSchedules(Array.isArray(schedulesData) ? schedulesData : []);
  }

  const allFridgesSelected = fridges.length > 0 && form.fridgeIds.length === fridges.length;

  function handleToggleAllFridges() {
    if (allFridgesSelected) {
      setForm((prev) => ({ ...prev, fridgeIds: [] }));
    } else {
      setForm((prev) => ({ ...prev, fridgeIds: fridges.map((f) => f.id) }));
    }
  }

  function handleToggleFridge(id) {
    setForm((prev) => {
      const exists = prev.fridgeIds.includes(id);
      return {
        ...prev,
        fridgeIds: exists ? prev.fridgeIds.filter((item) => item !== id) : [...prev.fridgeIds, id]
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const finalCron = buildCronExpression(form);

    const payload = {
      name: form.name.trim(),
      cronExpression: finalCron,
      format: form.format,
      fridgeIds: form.fridgeIds,
      recipients: splitRecipients(form.recipients),
      active: form.active
    };

    if (!payload.name || !payload.cronExpression || payload.recipients.length === 0) {
      setError('Completá nombre, programación y destinatarios.');
      return;
    }

    try {
      if (editingId) {
        await updateReportSchedule(editingId, payload);
        setSuccess('Programación actualizada.');
      } else {
        await createReportSchedule(payload);
        setSuccess('Programación creada.');
      }

      await refreshSchedules();
      resetForm();
    } catch (submitError) {
      setError(submitError?.data?.error || 'No se pudo guardar la programación');
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
        <p>Administrá los envíos automáticos de reportes por correo electrónico.</p>
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
                <h3>{editingId ? 'Editar programación' : 'Crear nueva programación'}</h3>
              </div>
            </div>

            <form className="admin-form" onSubmit={handleSubmit}>
              <label>
                Nombre del reporte
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ej: Reporte Diario de Temperatura"
                  required
                />
              </label>

              {/* SELECTOR VISUAL DE FRECUENCIA Y HORARIO */}
              <div className="admin-grid">
                <label>
                  Frecuencia de envío
                  <select
                    value={form.frequencyType}
                    onChange={(event) => setForm((current) => ({ ...current, frequencyType: event.target.value }))}
                  >
                    <option value="DAILY">Diario (Todos los días)</option>
                    <option value="WEEKLY">Semanal (Un día a la semana)</option>
                    <option value="MONTHLY">Mensual (Un día del mes)</option>
                    <option value="CUSTOM">Personalizado (Sintaxis Cron)</option>
                  </select>
                </label>

                {form.frequencyType !== 'CUSTOM' ? (
                  <label>
                    Hora de envío
                    <input
                      type="time"
                      value={form.time}
                      onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                      required
                    />
                  </label>
                ) : (
                  <label>
                    Expresión Cron
                    <input
                      type="text"
                      value={form.cronExpression}
                      onChange={(event) => setForm((current) => ({ ...current, cronExpression: event.target.value }))}
                      placeholder="0 8 * * *"
                      required
                    />
                  </label>
                )}
              </div>

              {/* OPCIONES ADICIONALES SEGÚN FRECUENCIA */}
              {form.frequencyType === 'WEEKLY' ? (
                <label>
                  Día de la semana
                  <select
                    value={form.dayOfWeek}
                    onChange={(event) => setForm((current) => ({ ...current, dayOfWeek: event.target.value }))}
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {form.frequencyType === 'MONTHLY' ? (
                <label>
                  Día del mes
                  <select
                    value={form.dayOfMonth}
                    onChange={(event) => setForm((current) => ({ ...current, dayOfMonth: event.target.value }))}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => (
                      <option key={dayNum} value={String(dayNum)}>
                        Día {dayNum}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {/* RESUMEN DE LA PROGRAMACIÓN RESULTANTE */}
              <div className="cron-preview-badge">
                <strong>Resumen:</strong> {describeCron(buildCronExpression(form))}
              </div>

              <div className="admin-grid">
                <label>
                  Formato del archivo
                  <select
                    value={form.format}
                    onChange={(event) => setForm((current) => ({ ...current, format: event.target.value }))}
                  >
                    <option value="CSV">CSV</option>
                    <option value="XLSX">Excel (.xlsx)</option>
                    <option value="PDF">PDF</option>
                  </select>
                </label>

                <label>
                  Destinatarios (separados por coma)
                  <input
                    type="text"
                    value={form.recipients}
                    onChange={(event) => setForm((current) => ({ ...current, recipients: event.target.value }))}
                    placeholder="ops@empresa.com, qa@empresa.com"
                    required
                  />
                </label>
              </div>

              {/* SELECTOR LIMPIO CON CHECKBOXES */}
              <div className="fridge-checkbox-section">
                <div className="fridge-checkbox-header">
                  <span>Refrigeradores a incluir ({form.fridgeIds.length} seleccionados)</span>
                  <label className="checkbox-field-inline">
                    <input
                      type="checkbox"
                      checked={allFridgesSelected}
                      onChange={handleToggleAllFridges}
                    />
                    <strong>
                      {allFridgesSelected ? 'Desmarcar todos' : 'Incluir todos los refrigeradores'}
                    </strong>
                  </label>
                </div>

                <div className="fridge-checkbox-list">
                  {fridges.map((fridge) => {
                    const isChecked = form.fridgeIds.includes(fridge.id);
                    return (
                      <label key={fridge.id} className={`fridge-checkbox-card ${isChecked ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleFridge(fridge.id)}
                        />
                        <div className="fridge-checkbox-info">
                          <span className="fridge-name">{fridge.name}</span>
                          <span className="fridge-sub">{fridge.location || `Slave ${fridge.modbusSlaveId}`}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                />
                Activar programación
              </label>

              <div className="button-row">
                <button className="button button-primary" type="submit">
                  {editingId ? 'Guardar cambios' : 'Crear programación'}
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
                <h3>Programaciones guardadas</h3>
              </div>
            </div>

            <div className="admin-table">
              {schedules.length > 0 ? (
                schedules.map((schedule) => (
                  <article key={schedule.id} className="admin-table-row">
                    <div>
                      <strong>{schedule.name}</strong>
                      <small className="schedule-human-cron">
                        🕒 {describeCron(schedule.cronExpression)}
                      </small>
                      <small>
                        Formato: {schedule.format} · Estado: {schedule.active ? 'Activo' : 'Inactivo'}
                      </small>
                      <small>✉️ {schedule.recipients?.join(', ')}</small>
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
                <div className="empty-state">No hay programaciones creadas todavía.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}