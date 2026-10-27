import { Link } from 'react-router-dom'
import { Star, ShieldCheck } from 'lucide-react'

export default function ProductCard({ product }) {
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
      <div className="relative overflow-hidden rounded-t-xl bg-gray-50">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => { e.target.src = 'https://placehold.co/300x300?text=Product' }}
        />
        {discount && (
          <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {discount}% OFF
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-xs text-purple-600 font-medium mb-1">{product.category}</p>
        <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{product.name}</h3>
        <div className="flex items-center gap-1 mb-2">
          <Star size={12} className="fill-yellow-400 text-yellow-400" />
          <span className="text-xs text-gray-600">{product.rating} ({product.reviews})</span>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="font-bold text-gray-900">₹{product.price.toLocaleString()}</span>
          {product.originalPrice && (
            <span className="text-xs text-gray-400 line-through">₹{product.originalPrice.toLocaleString()}</span>
          )}
        </div>
        {product.badge && (
          <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 rounded-full px-2 py-0.5 mb-3 w-fit">
            <ShieldCheck size={11} />
            <span>{product.badge}</span>
          </div>
        )}
        <Link
          to={`/product/${product.id}`}
          className="block text-center w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          View Product
        </Link>
      </div>
    </div>
  )
}
