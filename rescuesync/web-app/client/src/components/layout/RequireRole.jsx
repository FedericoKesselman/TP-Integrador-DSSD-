import PropTypes from 'prop-types';
import { Navigate, Outlet, useOutletContext } from 'react-router-dom';

// Ruta protegida por rol. El rol lo manda el server; esto solo evita mostrar
// pantallas que el backend igual rechazaría (los permisos reales se validan allá).
// Reenvía el contexto del layout ({ user }): un <Outlet> anidado no lo hereda solo.
function RequireRole({ allowed }) {
  const context = useOutletContext();
  return allowed ? <Outlet context={context} /> : <Navigate to="/emergencias" replace />;
}

RequireRole.propTypes = {
  allowed: PropTypes.bool.isRequired,
};

export default RequireRole;
