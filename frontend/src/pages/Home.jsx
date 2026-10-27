import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowRight, Star, ShieldCheck, TrendingUp, Users, Zap } from 'lucide-react'
import { PRODUCTS, CATEGORIES } from '../data/products'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const [query, setQuery] = useState('')
  const trending = PRODUCTS.slice(0, 4)

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-16 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <ShieldCheck size={13} /> AI-Powered Review Analysis
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
              Shop Smarter.<br />
              <span className="text-purple-600">Trust Real Reviews.</span>
            </h1>
            <p className="text-gray-500 mb-6 leading-relaxed max-w-md">
              We-Review helps you find genuine reviews and avoid fake ones so you can shop with confidence using advanced AI.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Explore Products <ArrowRight size={16} />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center gap-2 border border-purple-300 text-purple-700 font-semibold px-6 py-3 rounded-xl hover:bg-purple-50 transition-colors"
              >
                Learn More
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span className="text-sm font-bold text-gray-900">4.8/5</span>
              <span className="text-sm text-gray-500">Based on verified reviews</span>
            </div>
          </div>

          {/* Hero Image */}
          <div className="hidden md:flex justify-center">
            <div className="relative">
              <div className="w-80 h-80 bg-gradient-to-br from-purple-200 to-indigo-200 rounded-full flex items-center justify-center shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop"
                  alt="Product"
                  className="w-64 h-64 object-cover rounded-full"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-lg p-3 flex items-center gap-2">
                <ShieldCheck size={20} className="text-green-500" />
                <div>
                  <div className="text-xs font-bold text-gray-900">AI Verified</div>
                  <div className="text-xs text-gray-500">Review Analysis</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="max-w-7xl mx-auto mt-12 grid sm:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: 'AI Fake Review Detection', desc: 'Detects suspicious reviews using advanced AI', color: 'text-purple-600 bg-purple-50' },
            { icon: Users, title: 'Trusted Community', desc: 'Real user reviews from verified purchases', color: 'text-blue-600 bg-blue-50' },
            { icon: TrendingUp, title: 'Better Decisions', desc: 'Get honest feedback before you buy', color: 'text-green-600 bg-green-50' },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="bg-white rounded-xl p-4 flex items-start gap-3 shadow-sm border border-gray-100">
              <div className={`p-2 rounded-lg ${color}`}>
                <Icon size={18} />
              </div>
              <div>
                <div className="font-semibold text-gray-900 text-sm">{title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Shop by Category</h2>
          <Link to="/shop" className="text-sm text-purple-600 hover:underline flex items-center gap-1">View All <ArrowRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {CATEGORIES.map(cat => (
            <Link
              key={cat.name}
              to={`/shop?category=${encodeURIComponent(cat.name)}`}
              className="flex flex-col items-center gap-2 bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:border-purple-300 hover:shadow-md transition-all group"
            >
              <div className="text-3xl group-hover:scale-110 transition-transform">{cat.icon}</div>
              <span className="text-sm font-medium text-gray-700 text-center">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending Products */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Trending Products</h2>
          <Link to="/shop" className="text-sm text-purple-600 hover:underline flex items-center gap-1">View All <ArrowRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          {trending.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  )
}
