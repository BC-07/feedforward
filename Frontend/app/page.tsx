"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, Eye, MessageSquare, Shield } from "lucide-react";
import type { ReactNode } from "react";

const features: Array<{ icon: ReactNode; title: string; text: string }> = [
  {
    icon: <Shield className="h-8 w-8 text-orange-500" />,
    title: "Anonymous Feedback",
    text: "Submit concerns, suggestions, or compliments securely and confidently.",
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-orange-500" />,
    title: "Organized Workflow",
    text: "Feedback is categorized, tracked, and processed in one structured flow.",
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-orange-500" />,
    title: "Data Visibility",
    text: "Admins and leaders can see trends and prioritize real issues quickly.",
  },
  {
    icon: <Eye className="h-8 w-8 text-orange-500" />,
    title: "Transparent Tracking",
    text: "Users can follow status changes from submission to resolution.",
  },
];

const benefits: Array<{ title: string; items: string[] }> = [
  {
    title: "For Users",
    items: ["Know your voice is heard", "Report issues in minutes", "Track updates without follow-up calls"],
  },
  {
    title: "For Administrators",
    items: ["Filter and prioritize workload", "Respond faster with clearer context", "Reduce missed submissions"],
  },
  {
    title: "For Management",
    items: ["Monitor organization health", "Plan with real feedback signals", "Improve accountability and visibility"],
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-white via-orange-50 to-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-5xl font-semibold text-black md:text-6xl">Your Voice Matters</h1>
            <p className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-gray-700">
              FeedForward enables anonymous feedback, suggestions, and complaints through an organized system.
              Help build a better environment for everyone.
            </p>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/submit"
                className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-8 py-4 text-lg text-white transition-colors hover:bg-orange-600"
              >
                Submit Feedback
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="rounded-lg bg-black px-8 py-4 text-center text-lg text-white transition-colors hover:bg-gray-800"
              >
                Login / Sign Up
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-16 text-center text-4xl font-semibold text-black">Why Use FeedForward?</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-black">{feature.title}</h3>
                <p className="text-gray-600">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-16 text-center text-4xl font-semibold text-black">Benefits for Everyone</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-xl border border-gray-100 bg-white p-8 shadow-sm">
                <h3 className="mb-4 text-2xl font-semibold text-black">{benefit.title}</h3>
                <ul className="space-y-3 text-gray-700">
                  {benefit.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 text-orange-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-orange-500 to-orange-600 py-20 text-center text-white">
        <h2 className="mb-6 text-4xl font-semibold">Ready to Make Your Voice Heard?</h2>
        <p className="mb-8 text-xl text-white/90">
          Join the community in building a better organization together.
        </p>
        <Link
          href="/submit"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg text-orange-600 transition-colors hover:bg-gray-200"
        >
          Submit Your First Feedback
          <ArrowRight className="h-5 w-5" />
        </Link>
      </section>
    </div>
  );
}
