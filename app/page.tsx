"use client";
import Link from "next/link";
import { ArrowRight, Shield, MessageSquare, BarChart3, Eye } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-white via-orange-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl mb-6 text-black">
              Your Voice Matters
            </h1>
            <p className="text-xl text-gray-700 mb-10 max-w-3xl mx-auto leading-relaxed">
              FeedForward enables anonymous feedback, suggestions, and complaints through an organized system.
              Help us create a better environment for everyone.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/submit"
                className="px-8 py-4 bg-orange-500 text-white hover:bg-orange-600 rounded-lg transition-colors flex items-center justify-center gap-2 text-lg"
              >
                Submit Feedback
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link
                href="/login"
                className="px-8 py-4 bg-black text-white hover:bg-gray-800 rounded-lg transition-colors text-lg text-center"
              >
                Login / Sign Up
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why Use FeedForward */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl text-center mb-16 text-black">
            Why Use FeedForward?
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Feature
              icon={<Shield className="w-8 h-8 text-orange-500" />}
              title="Anonymous Feedback"
              text="Submit suggestions, complaints, or compliments anonymously without fear."
            />
            <Feature
              icon={<MessageSquare className="w-8 h-8 text-orange-500" />}
              title="Organized System"
              text="Feedback is categorized, prioritized, and tracked from submission to resolution."
            />
            <Feature
              icon={<BarChart3 className="w-8 h-8 text-orange-500" />}
              title="Data-Driven Insights"
              text="Management can analyze trends and make informed decisions based on feedback."
            />
            <Feature
              icon={<Eye className="w-8 h-8 text-orange-500" />}
              title="Transparency"
              text="Track the status of your feedback and see how concerns are being addressed."
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl text-center mb-16 text-black">
            Benefits for Everyone
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Benefit
              title="For Users"
              items={[
                "Know your voice is heard",
                "Help create a better environment",
                "Easy way to express concerns",
              ]}
            />
            <Benefit
              title="For Administrators"
              items={[
                "Manage feedback efficiently",
                "Improved monitoring and tracking",
                "Better organization of concerns",
              ]}
            />
            <Benefit
              title="For Management"
              items={[
                "Access summarized reports",
                "Make data-driven decisions",
                "Improved organizational planning",
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-orange-500 to-orange-600 text-center text-white">
        <h2 className="text-4xl mb-6">
          Ready to Make Your Voice Heard?
        </h2>
        <p className="text-xl text-white/90 mb-8">
          Join our community in building a better organization together through sambayanihan.
        </p>

        <Link
          href="/submit"
          className="px-8 py-4 bg-white text-orange-600 hover:bg-gray-200 rounded-lg transition-colors text-lg inline-flex items-center gap-2"
        >
          Submit Your First Feedback
          <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </div>
  );
}

const Feature = ({ icon, title, text }: any) => (
  <div className="text-center p-6">
    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
      {icon}
    </div>
    <h3 className="text-xl mb-3 text-black">{title}</h3>
    <p className="text-gray-600">{text}</p>
  </div>
);

const Benefit = ({ title, items }: any) => (
  <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
    <h3 className="text-2xl mb-4 text-black">{title}</h3>
    <ul className="space-y-3 text-gray-700">
      {items.map((item: string, i: number) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-orange-500 mt-1">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);