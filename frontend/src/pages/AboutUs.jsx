import { Shield, Target, Code2, BookOpen, Award, Users2 } from 'lucide-react'

const TEAM = [
  { name: 'Geeta Siddappa', role: 'ML Engineer & Lead Developer', initials: 'GS', color: 'bg-purple-100 text-purple-700' },
  { name: 'Team Member 2', role: 'Backend Developer', initials: 'T2', color: 'bg-blue-100 text-blue-700' },
  { name: 'Team Member 3', role: 'Frontend Developer', initials: 'T3', color: 'bg-green-100 text-green-700' },
]

const STEPS = [
  { title: 'Review Submitted', desc: 'User writes a review for a product.', icon: BookOpen },
  { title: 'AI Analysis', desc: 'Our model analyses text and behaviour patterns.', icon: Code2 },
  { title: 'Prediction Returned', desc: 'Classified as Genuine or Potentially Fake.', icon: Shield },
  { title: 'Informed Shopping', desc: 'Shop with confidence using trustworthy reviews.', icon: Award },
]

export default function AboutUs() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-white/20 p-4 rounded-2xl">
              <Shield size={36} className="text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold mb-4">About We-Review</h1>
          <p className="text-purple-100 text-lg leading-relaxed">
            We-Review is an AI-powered platform designed to help consumers make smarter buying decisions by detecting fake and manipulated product reviews.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-sm font-semibold px-3 py-1.5 rounded-full mb-4">
            <Target size={14} /> Our Mission
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Real Reviews. Better Choices.</h2>
          <p className="text-gray-500 leading-relaxed max-w-2xl mx-auto">
            Fake reviews are a growing problem in e-commerce, misleading consumers and harming honest sellers. Our mission is to bring transparency back to online shopping using AI.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: Code2, title: 'AI-Powered Detection', desc: 'We use TF-IDF + Logistic Regression and Random Forest models to identify suspicious reviews with 91.1% accuracy.', color: 'text-purple-600 bg-purple-50' },
            { icon: Users2, title: 'Trusted by Users', desc: 'Hundreds of reviews analysed, helping consumers make confident decisions with verified AI predictions.', color: 'text-blue-600 bg-blue-50' },
            { icon: Shield, title: 'Privacy First', desc: 'We never store personally identifiable information. Reviews are analysed securely and anonymously.', color: 'text-green-600 bg-green-50' },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
              <div className={`inline-flex p-3 rounded-xl mb-4 ${color}`}>
                <Icon size={22} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">How AI Review Detection Works</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-lg mb-3 shadow-lg">
                    {i + 1}
                  </div>
                  <div className="bg-purple-50 p-2 rounded-lg mb-3">
                    <Icon size={18} className="text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1 text-sm">{step.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Model Info */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6 mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Award size={20} className="text-purple-600" /> AI Model Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            {[
              ['Model Type', 'Text + Behavior Ensemble (Combined)'],
              ['Text Model', 'TF-IDF + Logistic Regression'],
              ['Behavior Model', 'Random Forest Classifier'],
              ['Test F1-Score', '0.9110 (91.1%)'],
              ['Training Data', '80,281 labelled reviews'],
              ['Features', '13 causal behavior + text features'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start gap-2">
                <span className="text-purple-600 font-semibold shrink-0">{label}:</span>
                <span className="text-gray-700">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Our Team</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            {TEAM.map(member => (
              <div key={member.name} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3 ${member.color}`}>
                  {member.initials}
                </div>
                <h3 className="font-bold text-gray-900 text-sm">{member.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
