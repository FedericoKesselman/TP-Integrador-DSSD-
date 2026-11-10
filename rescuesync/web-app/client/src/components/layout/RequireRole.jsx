import PropTypes from 'prop-types';
import { Navigate, Outlet } from 'react-router-dom';

// Ruta protegida por rol. El rol lo manda el server; esto solo evita mostrar
// pantallas que el backend igual rechazaría (los permisos reales se validan allá).
function RequireRole({ allowed }) {
  return allowed ? <Outlet /> : <Navigate to="/emergencias" replace />;
}

RequireRole.propTypes = {
  allowed: PropTypes.bool.isRequired,
};

export default RequireRole;
