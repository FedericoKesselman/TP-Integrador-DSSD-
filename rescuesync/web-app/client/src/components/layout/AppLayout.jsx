import PropTypes from 'prop-types';

import Header from './Header.jsx';

// Sin overflow en los contenedores: la barra de progreso y la columna lateral usan sticky.
function AppLayout({ roleLabel, children }) {
  return (
    <div className="relative isolate min-h-screen">
      <div aria-hidden="true" className="app-backdrop" />
      <Header roleLabel={roleLabel} />
      <main>{children}</main>
    </div>
  );
}

AppLayout.propTypes = {
  roleLabel: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

export default AppLayout;
