import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client.js';
import {
  createAlarmRecipient,
  deleteAlarmRecipient,
  listAlarmRecipients,
  updateAlarmRecipient
} from '../api/alarms.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { AlarmsList } from '../components/AlarmsList.jsx';
import { ExportButtons } from '../components/ExportButtons.jsx';

function getLast24HoursRange() {
  const to = new Date();
  const from = new Date(to);
  from.setHours(from.getHours() - 24);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

export default function AlarmsPage() {
  const [fridges, setFridges] = useState([]);
  const [alarms, setAlarms] = useState([]);
  const [status, setStatus] = useState('all');
  const [period, setPeriod] = useState('all');
  const [fridgeId, setFridgeId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [editingRecipientId, setEditingRecipientId] = useState('');
  const { isAdmin } = useAuth();
  const exportRange = getLast24HoursRange();
  const visibleAlarms = useMemo(() => {
    const now = Date.now();
    const cutoff = period === '24h' ? now - 24 * 60 * 60 * 1000 : period === 'week' ? now - 7 * 24 * 60 * 60 * 1000 : null;

    return alarms.filter((alarm) => {
      if (period === 'open' && alarm.resolvedAt) return false;
      if (cutoff && new Date(alarm.startedAt).getTime() < cutoff) return false;
      return true;
    });
  }, [alarms, period]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError('');

      try {
        const [fridgesData, alarmsData] = await Promise.all([
          apiRequest('/fridges'),
          apiRequest(
            `/alarms?status=${encodeURIComponent(status)}${fridgeId ? `&fridgeId=${encodeURIComponent(fridgeId)}` : ''}`
          )
        ]);

        if (!isMounted) {
          return;
        }

        setFridges(Array.isArray(fridgesData) ? fridgesData : []);
        setAlarms(Array.isArray(alarmsData) ? alarmsData : []);
        if (isAdmin) {
          const recipientsData = await listAlarmRecipients();
          setRecipients(Array.isArray(recipientsData) ? recipientsData : []);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError?.data?.error || 'No se pudo cargar la vista de alarmas');
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
  }, [status, fridgeId, isAdmin]);

  function startEditingRecipient(recipient) {
    setEditingRecipientId(recipient.id);
    setRecipientEmail(recipient.email);
  }

  function resetRecipientForm() {
    setEditingRecipientId('');
    setRecipientEmail('');
  }

  async function refreshRecipients() {
    const data = await listAlarmRecipients();
    setRecipients(Array.isArray(data) ? data : []);
  }

  async function handleRecipientSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      if (editingRecipientId) {
        await updateAlarmRecipient(editingRecipientId, { email: recipientEmail });
      } else {
        await createAlarmRecipient({ email: recipientEmail });
      }
      await refreshRecipients();
      resetRecipientForm();
    } catch (recipientError) {
      setError(recipientError?.data?.error || 'No se pudo guardar el destinatario');
    }
  }

  async function handleRecipientToggle(recipient) {
    try {
      await updateAlarmRecipient(recipient.id, { active: !recipient.active });
      await refreshRecipients();
    } catch (recipientError) {
      setError(recipientError?.data?.error || 'No se pudo actualizar el destinatario');
    }
  }

  async function handleRecipientDelete(recipientId) {
    try {
      await deleteAlarmRecipient(recipientId);
      await refreshRecipients();
      if (editingRecipientId === recipientId) {
        resetRecipientForm();
      }
    } catch (recipientError) {
      setError(recipientError?.data?.error || 'No se pudo eliminar el destinatario');
    }
  }

  return (
    <section className="page-stack">
      <div className="page-heading page-heading-split">
        <div>
          <span className="brand-kicker">Gestión de Alarmas</span>
          <h2>Eventos globales</h2>
          <p>Filtrar alarmas abiertas o resueltas, y acotar por refrigerador si lo necesitas.</p>
        </div>

        <div className="page-actions-stack">
          <div className="filters-bar card-shell">
            <label>
              Estado
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Todas</option>
                <option value="open">Abiertas</option>
                <option value="resolved">Resueltas</option>
              </select>
            </label>

            <label>
              Refrigerador
              <select value={fridgeId} onChange={(event) => setFridgeId(event.target.value)}>
                <option value="">Todos</option>
                {fridges.map((fridge) => (
                  <option key={fridge.id} value={fridge.id}>
                    {fridge.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Periodo
              <select value={period} onChange={(event) => setPeriod(event.target.value)}>
                <option value="all">Todas las fechas</option>
                <option value="24h">Últimas 24 horas</option>
                <option value="week">Última semana</option>
                <option value="open">Solo pendientes</option>
              </select>
            </label>
          </div>

          <ExportButtons fridgeId="all" from={exportRange.from} to={exportRange.to} filenamePrefix="alarmas" />
        </div>
      </div>

      {isLoading ? <div className="route-state">Cargando alarmas...</div> : null}
      {error ? <div className="state-card state-error">{error}</div> : null}

      {!isLoading && !error ? (
        <div className="card-shell">
          <AlarmsList alarms={visibleAlarms} paginated scrollable emptyMessage="No hay alarmas para los filtros seleccionados." />
        </div>
      ) : null}

      {isAdmin ? (
        <div className="card-shell">
          <div className="section-heading">
            <div>
              <span className="brand-kicker">Notificaciones</span>
              <h3>Destinatarios de alarmas</h3>
            </div>
          </div>

          <form className="admin-form" onSubmit={handleRecipientSubmit}>
            <label>
              Email
              <input
                type="email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="alertas@ejemplo.com"
                required
              />
            </label>
            <div className="button-row">
              <button className="button button-primary" type="submit">
                {editingRecipientId ? 'Guardar cambios' : 'Agregar destinatario'}
              </button>
              {editingRecipientId ? (
                <button className="button button-secondary" type="button" onClick={resetRecipientForm}>
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          <div className="admin-table">
            {recipients.length > 0 ? recipients.map((recipient) => (
              <article key={recipient.id} className="admin-table-row">
                <div>
                  <strong>{recipient.email}</strong>
                  <small>{recipient.active ? 'Activo' : 'Inactivo'}</small>
                </div>
                <div className="button-row">
                  <button className="button button-secondary" type="button" onClick={() => startEditingRecipient(recipient)}>
                    Editar
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => handleRecipientToggle(recipient)}>
                    {recipient.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="button button-secondary" type="button" onClick={() => handleRecipientDelete(recipient.id)}>
                    Eliminar
                  </button>
                </div>
              </article>
            )) : <div className="empty-state">No hay destinatarios configurados.</div>}
          </div>
        </div>
      ) : null}
    </section>
  );
}