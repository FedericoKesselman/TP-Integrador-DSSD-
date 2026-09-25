import PropTypes from 'prop-types';

import Header from './Header.jsx';

// Sin overflow en los contenedores: la barra de progreso y la columna lateral usan sticky.
function AppLayout({ userName, onLogout, children }) {
  return (
    <div className="relative isolate min-h-screen">
      <div aria-hidden="true" className="app-backdrop" />
      <Header userName={userName} onLogout={onLogout} />
      <main>{children}</main>
    </div>
  );
}

AppLayout.propTypes = {
  userName: PropTypes.string.isRequired,
  onLogout: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export default AppLayout;
