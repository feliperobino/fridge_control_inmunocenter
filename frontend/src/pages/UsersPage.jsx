import { useEffect, useState } from 'react';
import { createUser, deleteUser, listUsers, updateUser } from '../api/users.js';

const initialForm = {
  email: '',
  password: '',
  role: 'USER'
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      setIsLoading(true);

      try {
        const data = await listUsers();

        if (isMounted) {
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError?.data?.error || 'No se pudo cargar la lista de usuarios');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  function resetForm() {
    setForm(initialForm);
    setEditingId('');
  }

  function startEditing(user) {
    setEditingId(user.id);
    setForm({
      email: user.email,
      password: '',
      role: user.role
    });
  }

  async function refreshUsers() {
    const data = await listUsers();
    setUsers(Array.isArray(data) ? data : []);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.email.includes('@')) {
      setError('Ingresá un email válido.');
      return;
    }

    try {
      if (editingId) {
        const payload = { role: form.role };
        if (form.password.trim()) {
          payload.password = form.password;
        }
        await updateUser(editingId, payload);
        setSuccess('Usuario actualizado.');
      } else {
        if (!form.password.trim()) {
          setError('La contraseña es obligatoria para crear un usuario.');
          return;
        }

        await createUser({
          email: form.email,
          password: form.password,
          role: form.role
        });
        setSuccess('Usuario creado.');
      }

      await refreshUsers();
      resetForm();
    } catch (submitError) {
      setError(submitError?.data?.error || 'No se pudo guardar el usuario');
    }
  }

  async function handleDelete(userId) {
    await deleteUser(userId);
    await refreshUsers();
    if (editingId === userId) {
      resetForm();
    }
  }

  return (
    <section className="page-stack">
      <div className="page-heading">
        <span className="brand-kicker">Usuarios</span>
        <h2>Administración de cuentas</h2>
        <p>Creá, editá y borrá usuarios con rol ADMIN o USER.</p>
      </div>

      {isLoading ? <div className="route-state">Cargando usuarios...</div> : null}
      {error ? <div className="state-card state-error">{error}</div> : null}
      {success ? <div className="state-card">{success}</div> : null}

      {!isLoading ? (
        <div className="admin-layout">
          <div className="card-shell">
            <div className="section-heading">
              <div>
                <span className="brand-kicker">Formulario</span>
                <h3>{editingId ? 'Editar usuario' : 'Crear usuario'}</h3>
              </div>
            </div>

            <form className="admin-form" onSubmit={handleSubmit}>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </label>

              <div className="admin-grid">
                <label>
                  Contraseña {editingId ? '(opcional)' : ''}
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    required={!editingId}
                  />
                </label>

                <label>
                  Rol
                  <select
                    value={form.role}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </label>
              </div>

              <div className="button-row">
                <button className="button button-primary" type="submit">
                  {editingId ? 'Guardar cambios' : 'Crear usuario'}
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
                <h3>Usuarios creados</h3>
              </div>
            </div>

            <div className="admin-table">
              {users.length > 0 ? (
                users.map((user) => (
                  <article key={user.id} className="admin-table-row">
                    <div>
                      <strong>{user.email}</strong>
                      <small>{user.role}</small>
                    </div>

                    <div className="button-row">
                      <button className="button button-secondary" type="button" onClick={() => startEditing(user)}>
                        Editar
                      </button>
                      <button className="button button-secondary" type="button" onClick={() => handleDelete(user.id)}>
                        Borrar
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">No hay usuarios para mostrar.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}