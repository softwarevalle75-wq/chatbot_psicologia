import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Home, FilePlus2, FileText, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/university-logo-blanco.png';

export default function DashboardSidebar() {
  const { logout, role } = useAuth();
  const navigate = useNavigate();

  const adminItems = [
    { to: '/dashboard/admin', label: 'Inicio', icon: Home },
    { to: '/dashboard/admin/estudiantes', label: 'Creacion de estudiantes', icon: FilePlus2 },
    { to: '/dashboard/admin/pdfs', label: 'PDFs', icon: FileText },
  ];

  const practitionerItems = [
    { to: '/dashboard/practicante', label: 'Historial PDFs', icon: FileText },
  ];

  const items = role === 'admin' ? adminItems : practitionerItems;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-72 hidden lg:flex flex-col bg-gradient-to-b from-[#2f6ee5] to-[#2559be] text-white shadow-2xl">
      <div className="px-6 py-8 border-b border-white/20">
        <Link to={role === 'admin' ? '/dashboard/admin' : '/dashboard/practicante'} className="flex flex-col items-center gap-3">
          <img src={logo} alt="Universitaria de Colombia" className="w-24 h-24 object-contain" />
          <span className="text-center text-sm font-semibold tracking-wide text-white/95">Universitaria de Colombia</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  isActive ? 'bg-white text-[#2357bb] font-semibold' : 'text-white/90 hover:bg-white/15'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/20">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 py-3 text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
