import { LogIn } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState } from 'react';

import Alert from '../components/ui/Alert.jsx';
import Button from '../components/ui/Button.jsx';
import TextField from '../components/ui/TextField.jsx';
import { login } from '../services/auth-service.js';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(username, password);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-lift ring-1 ring-line"
      >
        <h1 className="text-xl font-bold text-ink">Ingresar a RescueSync</h1>

        {error && <Alert tone="error">{error}</Alert>}

        <TextField
          id="username"
          name="username"
          label="Usuario"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
        <TextField
          id="password"
          name="password"
          label="Contraseña"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />

        <Button type="submit" icon={LogIn} loading={loading} className="w-full">
          Ingresar
        </Button>

        {import.meta.env.VITE_USE_MOCK_API !== 'false' && (
          <div className="pt-2 border-t border-line text-xs text-ink-muted space-y-2">
            <p className="font-semibold text-ink-soft">Modo local / Mock activo (sin Bonita):</p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setUsername('CoordinadorR');
                  setPassword('123123123');
                }}
                className="text-left rounded-lg bg-paper-sunken px-2.5 py-1.5 hover:bg-brand-soft hover:text-brand transition-colors text-ink-soft"
              >
                👤 Cargar <span className="font-semibold">CoordinadorR</span> (Centro Coordinador)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('OperadorM');
                  setPassword('123123123');
                }}
                className="text-left rounded-lg bg-paper-sunken px-2.5 py-1.5 hover:bg-brand-soft hover:text-brand transition-colors text-ink-soft"
              >
                👤 Cargar <span className="font-semibold">OperadorM</span> (Operador Municipal)
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

LoginPage.propTypes = {
  onLogin: PropTypes.func.isRequired,
};

export default LoginPage;
