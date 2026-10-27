import { Link } from 'react-router-dom'
import { Shield, Globe, Mail, MessageCircle, Share2 } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-purple-600 rounded-lg p-1.5">
              <Shield size={16} className="text-white" />
            </div>
            <span className="font-bold text-white text-lg">We-Review</span>
          </div>
          <p className="text-sm leading-relaxed">Real Reviews. Better Choices.</p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            {[['/', 'Home'], ['/shop', 'Shop'], ['/dashboard', 'Categories'], ['/about', 'About']].map(([path, label]) => (
              <li key={path}><Link to={path} className="hover:text-white transition-colors">{label}</Link></li>
            ))}
          </ul>
        </div>

        {/* Support */}
        <div>
          <h4 className="text-white font-semibold mb-3">Support</h4>
          <ul className="space-y-2 text-sm">
            <li><span className="hover:text-white cursor-pointer">Help Center</span></li>
            <li><span className="hover:text-white cursor-pointer">Contact Us</span></li>
          </ul>
        </div>

        {/* Social */}
        <div>
          <h4 className="text-white font-semibold mb-3">Follow Us</h4>
          <div className="flex gap-3">
            {[Globe, Mail, MessageCircle, Share2].map((Icon, i) => (
              <button key={i} className="p-2 bg-gray-800 rounded-lg hover:bg-purple-600 transition-colors">
                <Icon size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-gray-800 text-center py-4 text-sm">
        © 2025 We-Review. All rights reserved.
      </div>
    </footer>
  )
}
