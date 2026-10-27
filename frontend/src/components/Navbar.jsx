import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Heart, Search, Shield, Menu, X, LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) navigate(`/shop?search=${encodeURIComponent(query.trim())}`)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-lg p-1.5 shadow-sm shadow-purple-500/20">
            <Shield size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 tracking-tight">We-Review</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link to="/" className="hover:text-purple-600 transition-colors">Home</Link>
          <Link to="/shop" className="hover:text-purple-600 transition-colors">Shop</Link>
          <Link to="/dashboard" className="hover:text-purple-600 transition-colors">Categories</Link>
          <Link to="/about" className="hover:text-purple-600 transition-colors">About</Link>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 hidden md:flex items-center max-w-md mx-auto">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </form>

        {/* Right Section: Auth & Actions */}
        <div className="ml-auto flex items-center gap-3">
          <button className="text-gray-600 hover:text-purple-600 transition-colors p-1" aria-label="Favorites">
            <Heart size={18} />
          </button>
          <button className="text-gray-600 hover:text-purple-600 transition-colors p-1" aria-label="Cart">
            <ShoppingCart size={18} />
          </button>

          {/* Auth State Links */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-gray-200">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 border border-purple-200 text-purple-700 font-bold flex items-center justify-center text-xs shadow-2xs">
                    {(user.name || user.username || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-900 max-w-[120px] truncate leading-tight">
                      {user.name || user.username}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono leading-none">
                      {user.reviewer_id}
                    </span>
                  </div>
                </div>
                <button
                  id="nav-logout-btn"
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Sign out of account"
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  id="nav-login-link"
                  to="/login"
                  className="text-xs font-semibold text-gray-700 hover:text-purple-600 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  id="nav-register-link"
                  to="/register"
                  className="text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg shadow-xs shadow-purple-600/20 transition-all"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden text-gray-600 p-1" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2 flex flex-col gap-3">
          <form onSubmit={handleSearch} className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <Search size={16} className="ml-3 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search products..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm focus:outline-none"
            />
          </form>

          {/* Navigation Links */}
          {[['/', 'Home'], ['/shop', 'Shop'], ['/dashboard', 'Categories'], ['/about', 'About']].map(([path, label]) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMenuOpen(false)}
              className="text-gray-700 font-medium hover:text-purple-600 py-1"
            >
              {label}
            </Link>
          ))}

          {/* Mobile Auth Actions */}
          <div className="pt-3 border-t border-gray-100">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs">
                    {(user.name || user.username || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-900">{user.name || user.username}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{user.reviewer_id}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleLogout()
                    setMenuOpen(false)
                  }}
                  className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg"
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-center text-xs font-semibold text-gray-700 border border-gray-200 py-2 rounded-lg hover:border-purple-300"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMenuOpen(false)}
                  className="text-center text-xs font-semibold bg-purple-600 text-white py-2 rounded-lg shadow-xs"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
