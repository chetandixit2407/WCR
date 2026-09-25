import React, { useState } from 'react';
import { 
  MessageSquare, Send, Check, Copy, Phone, PhoneMissed, 
  Calendar, Clock, MapPin, Building, X, ExternalLink, Sparkles 
} from 'lucide-react';
import { Candidate } from '../types';

interface WhatsAppReminderModalProps {
  candidate: Candidate;
  isOpen: boolean;
  onClose: () => void;
  defaultTemplate?: 'unanswered' | 'interview_reminder' | 'missed_followup';
  onWhatsAppSent?: (candidateId: string) => void;
}

export const WhatsAppReminderModal: React.FC<WhatsAppReminderModalProps> = ({
  candidate,
  isOpen,
  onClose,
  defaultTemplate = 'unanswered',
  onWhatsAppSent,
}) => {
  const [templateType, setTemplateType] = useState<'unanswered' | 'interview_reminder' | 'missed_followup'>(
    defaultTemplate
  );
  const [phone, setPhone] = useState(candidate.phone || '');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const interviewDate = candidate.interviewDate || 'Tomorrow';
  const interviewTime = candidate.interviewTime || '11:00 AM';
  const venue = '6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101';

  // Templates customized for White Collar Realty HR
  const getMessageContent = () => {
    if (templateType === 'unanswered') {
      return `Hello ${candidate.name},

This is Arjun, Virtual HR Assistant from *White Collar Realty*. 

We tried calling your number regarding your application for the *${candidate.appliedRole}* role, but were unable to connect on call.

Could you please reply to this WhatsApp message with a convenient time for a quick 2-minute screening call, or let us know if you are available today?

📍 *Interview Venue:* ${venue}
🏢 *White Collar Realty HR Desk*
Looking forward to speaking with you!`;
    }

    if (templateType === 'interview_reminder') {
      return `Hello ${candidate.name},

Gentle reminder regarding your upcoming face-to-face interview for the *${candidate.appliedRole}* position at *White Collar Realty*.

📅 *Date:* ${interviewDate}
⏰ *Time:* ${interviewTime}
📍 *Venue:* ${venue} (Landmark: M3M Urbana Business Park, Sector 67, Gurugram)
📄 *Bring:* Updated Resume & Govt ID Proof

We tried connecting over phone for a quick reconfirmation. Please reply *YES* to confirm your attendance, or let us know if you need to reschedule to an alternate slot.

Regards,
Arjun | White Collar Realty HR Team`;
    }

    return `Hello ${candidate.name},

This is Arjun from *White Collar Realty HR*. 

We noticed you were unable to attend your scheduled interview yesterday at our Sector 67 Gurugram office. We hope everything is fine at your end.

If you would like to reschedule your face-to-face interview for the *${candidate.appliedRole}* position, please reply with your preferred day and time. We have open interview slots available this week.

📍 *Venue:* ${venue}
Regards,
HR Recruitment | White Collar Realty`;
  };

  const messageText = getMessageContent();

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const cleanPhoneNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.startsWith('91') && digits.length === 12) return digits;
    return digits || '919876543210';
  };

  const handleOpenWhatsAppWeb = () => {
    const targetPhone = cleanPhoneNumber(phone);
    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    
    if (onWhatsAppSent) {
      onWhatsAppSent(candidate.id);
    }
    setSentSuccess(true);
    setTimeout(() => {
      setSentSuccess(false);
      onClose();
    }, 1800);
  };

  const handleSimulateLog = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSentSuccess(true);
      if (onWhatsAppSent) {
        onWhatsAppSent(candidate.id);
      }
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1600);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#0d1526] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-[#0e221b] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-['Space_Grotesk']">
                Send WhatsApp Reminder to Candidate
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  Instant Outreach
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Automated follow-up message when candidate does not pick up or call fails to connect
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {sentSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center gap-2.5 animate-in fade-in">
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-sm">WhatsApp Reminder Dispatched!</p>
                <p className="text-xs text-emerald-400/90">
                  Reminder logged to candidate follow-up records. Candidate marked with WhatsApp delivery timestamp.
                </p>
              </div>
            </div>
          )}

          {/* Scenario / Template Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Message Scenario
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTemplateType('unanswered')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  templateType === 'unanswered'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <PhoneMissed className="w-3.5 h-3.5 text-rose-400" />
                  <span>Call Not Connected</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Did not pick call / busy. Request callback time.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType('interview_reminder')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  templateType === 'interview_reminder'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Interview Reminder</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Scheduled slot reminder & Sector 67 venue confirmation.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTemplateType('missed_followup')}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  templateType === 'missed_followup'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Missed Follow-up</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Missed yesterday's slot. Offer rescheduling options.
                </p>
              </button>
            </div>
          </div>

          {/* Recipient Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Candidate WhatsApp Number
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-transparent w-full focus:outline-none text-slate-200"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Target Candidate
              </label>
              <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs flex items-center justify-between">
                <span className="font-semibold text-white">{candidate.name}</span>
                <span className="text-amber-400">{candidate.appliedRole}</span>
              </div>
            </div>
          </div>

          {/* Venue highlight */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-white">Interview Venue Pre-Loaded:</p>
              <p className="text-[11px] text-slate-300 mt-0.5">{venue}</p>
            </div>
          </div>

          {/* WhatsApp Message Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                Formatted WhatsApp Message Preview
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
              </button>
            </div>
            <div className="p-4 rounded-xl bg-[#061510] border border-emerald-900/60 text-slate-200 font-sans text-xs whitespace-pre-wrap leading-relaxed shadow-inner">
              {messageText}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSimulateLog}
            disabled={isSending || sentSuccess}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isSending ? 'Logging...' : 'Log as Sent in CRM'}</span>
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
              onClick={handleOpenWhatsAppWeb}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-bold transition shadow-md"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Send via WhatsApp Web</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
