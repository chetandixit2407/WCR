import React, { useState } from 'react';
import { X, UserPlus, Building, Phone, Mail, MapPin } from 'lucide-react';
import { Candidate } from '../types';

interface NewCandidateModalProps {
  onClose: () => void;
  onAddCandidate: (candidate: Candidate) => void;
}

export const NewCandidateModal: React.FC<NewCandidateModalProps> = ({
  onClose,
  onAddCandidate,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+91 9');
  const [email, setEmail] = useState('');
  const [appliedRole, setAppliedRole] = useState('Senior Luxury Property Consultant');
  const [location, setLocation] = useState('Golf Course Road, Gurgaon');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCand: Candidate = {
      id: `cand-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || '+91 98765 43210',
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      appliedRole,
      status: 'Screening Pending',
      screening: {
        currentLocation: location,
      },
      interviewStatus: 'Not Scheduled',
      callCount: 0,
      unansweredAttempts: 0,
      notes: 'New dummy candidate added for HR voice screening test.',
      callHistory: [],
    };

    onAddCandidate(newCand);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#0d1627] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-800 bg-[#0f192d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                Add Dummy Candidate
              </h3>
              <p className="text-xs text-slate-400">
                Create a test profile to screen with the HR Voice Agent
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Candidate Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Siddharth Mehra"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98100 12345"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siddharth@gmail.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Applied Position at White Collar Realty
            </label>
            <select
              value={appliedRole}
              onChange={(e) => setAppliedRole(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:outline-hidden focus:border-amber-500"
            >
              <option value="Senior Luxury Property Consultant">Senior Luxury Property Consultant (Gurgaon)</option>
              <option value="Real Estate Sales Manager (Gurgaon & Dubai)">Real Estate Sales Manager (Gurgaon & Dubai Desk)</option>
              <option value="Team Lead - Channel Partner Sales">Team Lead - Channel Partner Sales</option>
              <option value="Commercial Leasing Specialist">Commercial Leasing Specialist</option>
              <option value="Direct Luxury Sales Associate">Direct Luxury Sales Associate</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Initial Location / Base
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. DLF Phase 5, Gurgaon"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-md shadow-amber-500/20"
            >
              Create Candidate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
