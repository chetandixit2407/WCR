import React, { useState } from 'react';
import { 
  Mail, Send, Check, Copy, Calendar, Clock, MapPin, 
  Building, FileText, X, ExternalLink, Sparkles 
} from 'lucide-react';
import { Candidate } from '../types';

interface ConfirmationEmailModalProps {
  candidate: Candidate;
  isOpen: boolean;
  onClose: () => void;
  onEmailSent?: (candidateId: string) => void;
}

export const ConfirmationEmailModal: React.FC<ConfirmationEmailModalProps> = ({
  candidate,
  isOpen,
  onClose,
  onEmailSent,
}) => {
  const [recipientEmail, setRecipientEmail] = useState(candidate.email || '');
  const [subject, setSubject] = useState(
    `Interview Confirmation: ${candidate.appliedRole} Round - White Collar Realty Gurugram`
  );
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const interviewDate = candidate.interviewDate || 'Tomorrow';
  const interviewTime = candidate.interviewTime || '11:00 AM';
  const venueAddress = '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101';
  const landmark = 'M3M Urbana Business Park, Sector 67 (Near Golf Course Extension Road)';

  const emailBodyText = `Dear ${candidate.name},

Greetings from White Collar Realty!

Thank you for your interest in the ${candidate.appliedRole} position with our team. We are pleased to confirm your upcoming face-to-face interview round with our hiring leadership.

INTERVIEW DETAILS:
• Position: ${candidate.appliedRole}
• Date: ${interviewDate}
• Time: ${interviewTime}
• Venue: 6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101
• Landmark: ${landmark}
• Google Maps Location: https://maps.google.com/?q=M3M+Urbana+Business+Park+Sector+67+Gurugram

MANDATORY DOCUMENTS TO CARRY:
1. Updated physical copy of your Resume / CV
2. Government ID Proof (Aadhaar Card / PAN Card / Driving License)
3. Previous Real Estate sales credentials & recent salary slips / appointment letter

CONTACT & ASSISTANCE:
Upon arrival at Tower-A lobby, please inform the reception desk that you have arrived for the White Collar Realty interview with HR Team / Arjun. Should you require any guidance regarding the route or timing, reply directly to this email or contact our HR desk.

We look forward to meeting you and discussing your growth with White Collar Realty.

Warm regards,
HR Recruitment Team
White Collar Realty
6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram`;

  const handleCopy = () => {
    navigator.clipboard.writeText(emailBodyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendEmail = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSentSuccess(true);
      if (onEmailSent) {
        onEmailSent(candidate.id);
      }
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1600);
    }, 700);
  };

  const handleOpenMailClient = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(emailBodyText)}`;
    window.location.href = mailtoUrl;
    if (onEmailSent) {
      onEmailSent(candidate.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#0d1526] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-[#121c33] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-['Space_Grotesk']">
                Send Interview Confirmation Mail
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Ready to Dispatch
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Official interview call letter with Sector 67 venue details and guidelines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {sentSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 animate-in fade-in">
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Confirmation Email Sent Successfully!</p>
                <p className="text-xs text-emerald-400/90">
                  Official interview call letter dispatched to {recipientEmail}. Candidate activity log updated.
                </p>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Candidate Recipient
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="bg-transparent w-full focus:outline-none text-slate-200"
                  placeholder="candidate@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Interview Slot Scheduled
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 text-xs font-semibold">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>{interviewDate} at {interviewTime}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Email Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Venue highlight box */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
              <MapPin className="w-4 h-4" />
              <span>Face-to-Face Venue Included in Email</span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              {venueAddress}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              <span>Landmark: {landmark}</span>
            </div>
          </div>

          {/* Email Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Letter Preview
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Letter Text'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 text-slate-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
              {emailBodyText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenMailClient}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Mail App (Gmail/Outlook)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSending || sentSuccess}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold transition shadow-md disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending Dispatch...' : sentSuccess ? 'Sent!' : 'Send Confirmation Email'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
