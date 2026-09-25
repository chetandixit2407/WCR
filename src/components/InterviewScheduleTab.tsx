import React from 'react';
import { 
  Calendar, Clock, MapPin, CheckCircle2, User, PhoneCall, 
  CalendarCheck, AlertCircle, XCircle, RefreshCw, Shield,
  Mail, MessageSquare 
} from 'lucide-react';
import { InterviewSlot, Candidate } from '../types';

interface InterviewScheduleTabProps {
  slots: InterviewSlot[];
  candidates: Candidate[];
  onTriggerCall: (candidate: Candidate, scenario: string) => void;
  onCancelBooking: (slotId: string) => void;
  onRescheduleClick: (candidate: Candidate) => void;
  onOpenConfirmationMail?: (candidate: Candidate) => void;
  onOpenWhatsApp?: (candidate: Candidate, template?: 'unanswered' | 'interview_reminder' | 'missed_followup') => void;
}

export const InterviewScheduleTab: React.FC<InterviewScheduleTabProps> = ({
  slots,
  candidates,
  onTriggerCall,
  onCancelBooking,
  onRescheduleClick,
  onOpenConfirmationMail,
  onOpenWhatsApp,
}) => {
  const bookedSlots = slots.filter((s) => !s.isAvailable);
  const openSlots = slots.filter((s) => s.isAvailable);

  return (
    <div className="space-y-6">
      {/* Office Venue Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0f1b33] via-slate-900 to-[#141d33] border border-amber-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
                  White Collar Realty • Corporate HQ Interview Center
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  Conflict-Free Booking System
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                6th floor, TOWER-A, M3M Urbana Business Park, Sector 67, Gurugram, Haryana 122101.
                <span className="text-slate-400 ml-2">(Landmark: M3M Urbana, Sector 67, Golf Course Extension Road corridor)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-slate-400 text-[10px]">Open Slots</div>
              <div className="font-bold text-emerald-400 text-base">{openSlots.length}</div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-slate-400 text-[10px]">Booked Interviews</div>
              <div className="font-bold text-amber-400 text-base">{bookedSlots.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Slots */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Sample Interview Schedule & Attendance Track</span>
          </h3>
          <span className="text-xs text-slate-400">
            Automated conflict prevention active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slots.map((slot) => {
            const bookedCandidate = candidates.find((c) => c.interviewSlotId === slot.id);

            return (
              <div
                key={slot.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  slot.isAvailable
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    : 'bg-[#101b30] border-amber-500/30 shadow-lg shadow-amber-950/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <CalendarCheck className="w-3.5 h-3.5 text-amber-400" />
                      {slot.date}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        slot.isAvailable
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {slot.isAvailable ? 'Slot Available' : 'Booked'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>{slot.time}</span>
                  </div>

                  <p className="text-[11px] text-slate-400 mb-4 truncate">
                    {slot.venue}
                  </p>

                  {/* Candidate Info if Booked */}
                  {bookedCandidate ? (
                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-amber-400" />
                          {bookedCandidate.name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                            bookedCandidate.interviewStatus === 'Confirmed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {bookedCandidate.interviewStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {bookedCandidate.appliedRole}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {bookedCandidate.phone}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg bg-slate-950/30 border border-dashed border-slate-800 mb-3 text-center text-xs text-slate-500">
                      Open slot ready for screening agent assignment
                    </div>
                  )}
                </div>

                {/* Slot Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap">
                  {bookedCandidate ? (
                    <>
                      <button
                        onClick={() => onTriggerCall(bookedCandidate, 'reminder')}
                        className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 py-1.5 px-2.5 rounded-lg transition"
                        title="Call candidate to reconfirm interview attendance"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Reconfirm Attendance</span>
                      </button>

                      {onOpenConfirmationMail && (
                        <button
                          onClick={() => onOpenConfirmationMail(bookedCandidate)}
                          className="text-xs text-amber-400 hover:text-amber-300 p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition"
                          title="Send interview confirmation email with Sector 67 venue details"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {onOpenWhatsApp && (
                        <button
                          onClick={() => onOpenWhatsApp(bookedCandidate, 'interview_reminder')}
                          className="text-xs text-emerald-400 hover:text-emerald-300 p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition"
                          title="Send WhatsApp interview reminder"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => onRescheduleClick(bookedCandidate)}
                        className="text-xs text-amber-400 hover:text-amber-300 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                        title="Reschedule this interview"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onCancelBooking(slot.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
                        title="Cancel booking and free this slot"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">
                      Agent will offer this slot during screening
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
