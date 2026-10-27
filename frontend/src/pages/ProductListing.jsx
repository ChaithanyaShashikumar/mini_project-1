import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { PRODUCTS, CATEGORIES } from '../data/products'
import ProductCard from '../components/ProductCard'

const PRICE_RANGES = [
  { label: '₹0 – ₹1,000', min: 0, max: 1000 },
  { label: '₹1,000 – ₹2,000', min: 1000, max: 2000 },
  { label: '₹2,000 – ₹3,000', min: 2000, max: 3000 },
  { label: '₹3,000+', min: 3000, max: Infinity },
]

const RATINGS = [5, 4, 3, 2]

export default function ProductListing() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('search') || '')
  const [selectedCategories, setSelectedCategories] = useState(
    searchParams.get('category') ? [searchParams.get('category')] : []
  )
  const [selectedPrices, setSelectedPrices] = useState([])
  const [selectedRatings, setSelectedRatings] = useState([])
  const [sortBy, setSortBy] = useState('popularity')
  const [showFilters, setShowFilters] = useState(true)

  const toggle = (list, setList, val) =>
    setList(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])

  const clearAll = () => {
    setQuery('')
    setSelectedCategories([])
    setSelectedPrices([])
    setSelectedRatings([])
  }

  const filtered = useMemo(() => {
    let results = PRODUCTS.filter(p => {
      const matchesQuery = !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase())
      const matchesCat = selectedCategories.length === 0 || selectedCategories.includes(p.category)
      const matchesPrice = selectedPrices.length === 0 || selectedPrices.some(r => p.price >= r.min && p.price <= r.max)
      const matchesRating = selectedRatings.length === 0 || selectedRatings.some(r => p.rating >= r)
      return matchesQuery && matchesCat && matchesPrice && matchesRating
    })
    if (sortBy === 'price-low') results.sort((a, b) => a.price - b.price)
    else if (sortBy === 'price-high') results.sort((a, b) => b.price - a.price)
    else if (sortBy === 'rating') results.sort((a, b) => b.rating - a.rating)
    return results
  }, [query, selectedCategories, selectedPrices, selectedRatings, sortBy])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:border-purple-400 transition-colors"
          >
            <SlidersHorizontal size={15} /> Filters
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="popularity">Popularity</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Rating</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Filters */}
        {showFilters && (
          <aside className="w-56 shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Filters</h3>
                <button onClick={clearAll} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                  <X size={12} /> Clear All
                </button>
              </div>

              {/* Category */}
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Category</h4>
                <div className="space-y-1.5">
                  {CATEGORIES.map(cat => (
                    <label key={cat.name} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.name)}
                        onChange={() => toggle(selectedCategories, setSelectedCategories, cat.name)}
                        className="accent-purple-600 w-3.5 h-3.5"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900">{cat.name} ({cat.count})</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div className="mb-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Price Range</h4>
                <div className="space-y-1.5">
                  {PRICE_RANGES.map(range => (
                    <label key={range.label} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedPrices.includes(range)}
                        onChange={() => toggle(selectedPrices, setSelectedPrices, range)}
                        className="accent-purple-600 w-3.5 h-3.5"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900">{range.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Rating</h4>
                <div className="space-y-1.5">
                  {RATINGS.map(r => (
                    <label key={r} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedRatings.includes(r)}
                        onChange={() => toggle(selectedRatings, setSelectedRatings, r)}
                        className="accent-purple-600 w-3.5 h-3.5"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900">{r}★ & above</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={clearAll}
                className="mt-4 w-full text-center text-sm bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </aside>
        )}

        {/* Product Grid */}
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-4">
            All Products <span className="font-semibold text-gray-800">({filtered.length})</span>
          </p>
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
