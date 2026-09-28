import PropTypes from 'prop-types';

import Header from './Header.jsx';

// Sin overflow en los contenedores: la barra de progreso y la columna lateral usan sticky.
function AppLayout({ user, userName, onLogout, children }) {
  return (
    <div className="relative isolate min-h-screen">
      <div aria-hidden="true" className="app-backdrop" />
      <Header user={user} userName={userName || user?.username || ''} onLogout={onLogout} />
      <main>{children}</main>
    </div>
  );
}

AppLayout.propTypes = {
  user: PropTypes.shape({
    username: PropTypes.string,
    role: PropTypes.string,
  }),
  userName: PropTypes.string,
  onLogout: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

AppLayout.defaultProps = {
  user: null,
  userName: '',
};

export default AppLayout;
