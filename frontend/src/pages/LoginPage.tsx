import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/loguito.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identificador.trim() || !password.trim()) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      await login(identificador.trim(), password);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen font-['Inter',sans-serif] overflow-hidden">
      {/* ── Panel izquierdo: Branding ─────────────────────────── */}
      <div className="hidden lg:flex w-[42%] bg-[#4285f4] flex-col items-center justify-center relative">
        {/* Overlay sutil para profundidad */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-blue-700/30" />

        <div className="relative z-10 flex flex-col items-center gap-3 px-8">
          {/* Logo */}
          <img
            src={logo}
            alt="Logo Chatbot Psicologico"
            className="w-72 h-72 object-contain"
          />

          {/* Titulo */}
          <h1 className="text-white text-4xl font-extrabold text-center leading-tight tracking-tight">
            Chatbot<br />Psicologico
          </h1>
          <p className="text-white/75 text-lg font-semibold tracking-wide">
            Tu asistente virtual
          </p>
        </div>
      </div>

      {/* ── Panel derecho: Formulario ─────────────────────────── */}
      <div className="flex-1 bg-gradient-to-br from-blue-100 via-blue-200/80 to-indigo-200 flex items-center justify-center px-6 py-8">
        {/* Tarjeta del formulario */}
        <div className="w-full max-w-[440px] bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl shadow-blue-900/8 p-8 sm:p-10">
          {/* Branding mobile (solo visible en < lg) */}
          <div className="flex lg:hidden flex-col items-center mb-6">
            <img
              src={logo}
              alt="Logo Chatbot Psicologico"
              className="w-28 h-28 object-contain mb-3"
            />
            <span className="text-blue-600 font-bold text-lg">Chatbot Psicologico</span>
          </div>

          {/* Encabezado */}
          <h2 className="text-2xl sm:text-[28px] font-extrabold text-gray-900 leading-tight">
            Iniciar Sesion
          </h2>
          <p className="text-gray-500 text-sm mt-1.5 mb-7 leading-relaxed">
            ¡Bienvenido! Si eres nuevo, por favor regístrate antes de ingresar tus datos.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email o Documento */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Email o Documento
              </label>
              <input
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="ejemplo@correo.com"
                autoComplete="username"
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50/80 border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
              />
            </div>

            {/* Contrasena */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Contrasena
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3.5 pr-12 rounded-xl bg-gray-50/80 border border-gray-200 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Boton */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-1 rounded-full bg-[#4a8af4] hover:bg-[#3b7de6] active:bg-[#3271d9] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm tracking-wide shadow-lg shadow-blue-300/30 transition-all duration-200 cursor-pointer"
            >
              {loading ? 'Cargando...' : 'Iniciar sesion'}
            </button>
          </form>

          {/* Link a registro */}
          <div className="mt-7 text-center">
            <p className="text-xs text-gray-500 mb-2 tracking-wide uppercase">
              ¿Aún no tienes una cuenta?
            </p>
            <Link
              to="/registro"
              className="inline-flex items-center justify-center rounded-full border border-blue-500 text-blue-600 hover:text-white hover:bg-blue-500 font-semibold text-sm px-6 py-2 transition-all duration-200"
            >
              Registrarme
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
