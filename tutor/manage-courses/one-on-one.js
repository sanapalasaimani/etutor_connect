import { supabase } from '../../src/supabase.js';

export async function renderOneOnOneView(containerId) {
    const { data: { session } } = await supabase.auth.getSession();
    const currentTutorId = session?.user?.id;

    const container = document.getElementById(containerId);
    container.innerHTML = `
        <div class="flex items-center gap-4 mb-6">
            <button onclick="window.manageCoursesState.showView('main')" class="p-2 hover:bg-gray-100 transition text-gray-500">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>
            <div>
                <h2 class="text-2xl font-bold">1-on-1 Sessions</h2>
                <p class="text-gray-500 text-sm">Students book your free available slots</p>
            </div>
            <div class="ml-auto flex gap-3">
                <button onclick="window.oneOnOneState.openRateModal()" class="bg-white border border-gray-200 text-gray-700 font-medium px-4 py-2 text-sm shadow-sm hover:bg-gray-50 transition flex items-center gap-2">
                    <i data-lucide="settings" class="w-4 h-4"></i>
                    Rate Settings
                </button>
                <button onclick="window.oneOnOneState.openManageSlotsModal()" class="bg-green-700 text-white font-medium px-4 py-2 text-sm shadow-sm hover:bg-green-800 transition flex items-center gap-2">
                    <i data-lucide="calendar" class="w-4 h-4"></i>
                    Manage Free Slots
                </button>
            </div>
        </div>

        <div class="grid grid-cols-4 gap-6 mb-8" id="ooo-stats">
            <div class="bg-white p-6 border border-gray-100 shadow-sm"><p class="text-gray-500 text-sm font-medium mb-1">Upcoming Sessions</p><p class="text-3xl font-bold text-gray-900" id="stat-upcoming">0</p></div>
            <div class="bg-white p-6 border border-gray-100 shadow-sm"><p class="text-gray-500 text-sm font-medium mb-1">Free Slots Available</p><p class="text-3xl font-bold text-gray-900" id="stat-slots">0</p></div>
        </div>

        <div class="flex gap-2 mb-6 border-b border-gray-100">
            <button class="px-5 py-2.5 bg-gray-50/70 border border-gray-200 border-b-0 text-sm font-medium text-gray-800 shadow-sm relative top-[1px]">Your Calendar</button>
        </div>

        <div class="bg-white border border-gray-200 p-8 mb-8 min-h-[300px]">
            <div class="flex justify-between items-center mb-6 border-b pb-4">
                <p class="font-medium text-gray-800">Scheduled Sessions & Free Slots</p>
            </div>
            <div id="ooo-sessions-list" class="space-y-4">
                <div class="flex flex-col items-center justify-center text-gray-400 py-12">
                    <p>Loading your calendar...</p>
                </div>
            </div>
        </div>
        
        <div id="ooo-modal-container"></div>
    `;

    lucide.createIcons();

    window.oneOnOneState = {
        openRateModal: async function() {
            const { data: profile } = await supabase.from('tutor_profiles').select('base_rate').eq('user_id', currentTutorId).single();
            this.renderRateModal(profile?.base_rate || 50);
        },
        openManageSlotsModal: function() {
            this.renderManageSlotsModal();
        },
        closeModal: function() {
            document.getElementById('ooo-modal-container').innerHTML = '';
        },
        saveRate: async function() {
            const btn = event.target;
            const rate = parseFloat(document.querySelector('input[placeholder="50"]').value);
            btn.disabled = true;
            btn.textContent = 'Saving...';

            const { error } = await supabase.from('tutor_profiles').update({ base_rate: rate }).eq('user_id', currentTutorId);
            if (error) alert('Error: ' + error.message);
            else alert('Rate saved!');
            this.closeModal();
        },
        addSlot: async function() {
            const date = document.getElementById('slot-date').value;
            const startTime = document.getElementById('slot-start').value;
            const endTime = document.getElementById('slot-end').value;
            
            if(!date || !startTime || !endTime) return alert('All fields required');
            
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = 'Adding...';

            const start = new Date(`${date}T${startTime}`).toISOString();
            const end = new Date(`${date}T${endTime}`).toISOString();

            const { error } = await supabase.from('tutor_slots').insert({
                tutor_id: currentTutorId,
                start_time: start,
                end_time: end,
                is_booked: false
            });

            if (error) alert('Error: ' + error.message);
            else {
                alert('Free slot added!');
                this.renderManageSlotsModal();
                loadSessions(currentTutorId);
            }
        },
        deleteSlot: async function(id) {
            if(!confirm('Delete this slot?')) return;
            const { error } = await supabase.from('tutor_slots').delete().eq('id', id);
            if (error) alert('Error: ' + error.message);
            else {
                this.renderManageSlotsModal();
                loadSessions(currentTutorId);
            }
        },
        renderRateModal: function(currentRate) {
            const modalHtml = `
                <div class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans">
                    <div class="bg-[#fafafa] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-fadeIn">
                        <div class="px-6 py-5 flex justify-between items-center bg-white border-b border-gray-100">
                            <h2 class="text-xl font-bold text-gray-900">Session Rate</h2>
                            <button onclick="window.oneOnOneState.closeModal()" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-5 h-5"></i></button>
                        </div>
                        <div class="p-8 space-y-6">
                            <div>
                                <label class="block text-sm font-semibold text-gray-700 mb-2">Hourly Rate (₹)</label>
                                <input type="number" value="${currentRate}" placeholder="50" class="w-full px-4 py-3 border border-gray-200 outline-none focus:border-green-600 shadow-sm transition">
                            </div>
                        </div>
                        <div class="px-8 py-5 border-t border-gray-100 bg-white flex justify-end gap-3">
                            <button onclick="window.oneOnOneState.closeModal()" class="px-6 py-2.5 text-gray-700 font-medium border border-gray-200 hover:bg-gray-50 transition">Cancel</button>
                            <button onclick="window.oneOnOneState.saveRate()" class="px-6 py-2.5 bg-green-700 text-white font-medium hover:bg-green-800 transition shadow-sm">Save</button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('ooo-modal-container').innerHTML = modalHtml;
            lucide.createIcons();
        },
        renderManageSlotsModal: async function() {
            const { data: slots } = await supabase.from('tutor_slots').select('*').eq('tutor_id', currentTutorId).eq('is_booked', false).order('start_time', { ascending: true });
            
            const modalHtml = `
                <div class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 font-sans">
                    <div class="bg-white shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-fadeIn h-[80vh]">
                        <div class="px-6 py-5 flex justify-between items-center bg-white border-b border-gray-100">
                            <h2 class="text-xl font-bold text-gray-900">Manage Free Availability</h2>
                            <button onclick="window.oneOnOneState.closeModal()" class="text-gray-400 hover:text-gray-600"><i data-lucide="x" class="w-6 h-6"></i></button>
                        </div>
                        
                        <div class="p-6 border-b border-gray-100 bg-gray-50 space-y-4">
                            <p class="text-sm font-bold text-gray-700 uppercase tracking-wider">Add New Free Slot</p>
                            <div class="grid grid-cols-3 gap-3">
                                <input type="date" id="slot-date" class="p-2.5 border border-gray-200 outline-none text-sm">
                                <input type="time" id="slot-start" class="p-2.5 border border-gray-200 outline-none text-sm">
                                <input type="time" id="slot-end" class="p-2.5 border border-gray-200 outline-none text-sm">
                            </div>
                            <button onclick="window.oneOnOneState.addSlot()" class="w-full bg-green-700 text-white py-2.5 font-bold hover:bg-green-800 transition shadow-sm">Add Slot to Calendar</button>
                        </div>

                        <div class="flex-1 overflow-y-auto p-6 space-y-3">
                            <p class="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Your Active Free Slots</p>
                            ${slots?.length ? slots.map(s => `
                                <div class="flex justify-between items-center p-4 border border-gray-100 bg-white group hover:border-green-100 transition">
                                    <div class="flex items-center gap-4">
                                        <div class="bg-green-50 text-green-700 p-2"><i data-lucide="calendar" class="w-4 h-4"></i></div>
                                        <div>
                                            <p class="font-bold text-gray-900 text-sm">${new Date(s.start_time).toLocaleDateString()}</p>
                                            <p class="text-xs text-gray-500">${new Date(s.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${new Date(s.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                        </div>
                                    </div>
                                    <button onclick="window.oneOnOneState.deleteSlot('${s.id}')" class="text-gray-400 hover:text-red-600 p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                                </div>
                            `).join('') : '<p class="text-center text-gray-400 py-10">No free slots added</p>'}
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('ooo-modal-container').innerHTML = modalHtml;
            lucide.createIcons();
        }
    };
    
    loadSessions(currentTutorId);
}

async function loadSessions(tutorId) {
    const list = document.getElementById('ooo-sessions-list');
    
    // Fetch both bookings and free slots
    const { data: bookings } = await supabase.from('bookings').select('*').eq('tutor_id', tutorId);
    const { data: slots } = await supabase.from('tutor_slots').select('*').eq('tutor_id', tutorId).order('start_time', { ascending: true });

    if (!bookings?.length && !slots?.length) {
        list.innerHTML = `<div class="flex flex-col items-center justify-center text-gray-400 py-12"><p>Your calendar is empty</p></div>`;
        document.getElementById('stat-upcoming').textContent = '0';
        document.getElementById('stat-slots').textContent = '0';
        return;
    }

    const upcoming = bookings?.filter(b => b.status === 'Scheduled').length || 0;
    const freeSlots = slots?.filter(s => !s.is_booked).length || 0;
    
    document.getElementById('stat-upcoming').textContent = upcoming;
    document.getElementById('stat-slots').textContent = freeSlots;

    let html = '';
    
    // Combine and sort
    const calendarItems = [
        ...(bookings || []).map(b => ({ ...b, type: 'booking' })),
        ...(slots || []).map(s => ({ ...s, type: 'slot' }))
    ].sort((a, b) => new Date(a.datetime || a.start_time) - new Date(b.datetime || b.start_time));

    list.innerHTML = calendarItems.map(item => {
        if(item.type === 'booking') {
            return `
                <div class="p-4 border border-gray-100 bg-white flex justify-between items-center shadow-sm">
                    <div class="flex items-center gap-4">
                        <div class="bg-blue-50 text-blue-600 p-2"><i data-lucide="user" class="w-5 h-5"></i></div>
                        <div>
                            <p class="font-bold text-gray-900">Session with Student</p>
                            <p class="text-xs text-gray-500">${new Date(item.datetime).toLocaleString()}</p>
                        </div>
                    </div>
                    <span class="status-badge status-scheduled">${item.status}</span>
                </div>
            `;
        } else if(!item.is_booked) {
            return `
                <div class="p-4 border border-dashed border-green-200 bg-green-50/30 flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <div class="bg-green-100 text-green-700 p-2"><i data-lucide="calendar" class="w-5 h-5"></i></div>
                        <div>
                            <p class="font-bold text-green-800">Free Slot Available</p>
                            <p class="text-xs text-green-600">${new Date(item.start_time).toLocaleString()} - ${new Date(item.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold text-green-600 uppercase">Awaiting Student</span>
                </div>
            `;
        }
        return '';
    }).join('');
    
    lucide.createIcons();
}
