import { ChevronLeft, ChevronRight, FilePlus2, FileText, Home, LogOut } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import logo from '../../assets/university-logo-blanco.png';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from './DashboardLayout';

export default function DashboardSidebar() {
  const { logout, role } = useAuth();
  const navigate = useNavigate();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const adminItems = [
    { to: '/dashboard/admin', label: 'Inicio', icon: Home, end: true },
    { to: '/dashboard/admin/estudiantes', label: 'Creación de estudiantes', icon: FilePlus2, end: true },
    { to: '/dashboard/admin/pdfs', label: 'PDFs', icon: FileText, end: true },
  ];

  const practitionerItems = [{ to: '/dashboard/practicante', label: 'Historial PDFs', icon: FileText, end: true }];

  const items = role === 'admin' ? adminItems : practitionerItems;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 hidden lg:flex flex-col bg-gradient-to-b from-[#2f6ee5] to-[#2559be] text-white shadow-2xl transition-all duration-300 z-50 ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div className={`py-6 border-b border-white/20 ${isCollapsed ? 'px-2' : 'px-6'}`}>
        <Link to={role === 'admin' ? '/dashboard/admin' : '/dashboard/practicante'} className="flex flex-col items-center gap-3">
          <img
            src={logo}
            alt="Consultorio Psicológico"
            className={`object-contain transition-all duration-300 ${isCollapsed ? 'w-12 h-12' : 'w-24 h-24'}`}
          />
          {!isCollapsed && (
            <span className="text-center text-sm font-semibold tracking-wide text-white/95">Consultorio Psicológico</span>
          )}
        </Link>
      </div>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-1.5 shadow-lg hover:bg-gray-100 transition-all duration-200"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4 text-blue-600" /> : <ChevronLeft className="w-4 h-4 text-blue-600" />}
      </button>

      <nav className={`flex-1 py-6 space-y-2 ${isCollapsed ? 'px-2' : 'px-4'}`}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center rounded-xl transition ${
                  isCollapsed ? 'justify-center py-3' : 'gap-3 px-4 py-3'
                } ${isActive ? 'bg-white text-[#2357bb] font-semibold' : 'text-white/90 hover:bg-white/15'}`
              }
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className={`border-t border-white/20 ${isCollapsed ? 'px-2' : 'p-4'}`}>
        <button
          onClick={handleLogout}
          className={`flex items-center rounded-xl w-full hover:bg-white/15 py-3 text-sm font-medium transition ${
            isCollapsed ? 'justify-center' : 'justify-center gap-2'
          }`}
          title={isCollapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}
