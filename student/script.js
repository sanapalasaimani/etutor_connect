import { supabase } from '../src/supabase.js';
import { getThumbnailUrl } from '../src/utils.js';


let currentUser = null;
let currentProfile = null;



document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/login.html';
        return;
    }
    currentUser = session.user;

    // Fetch Profile and check blocked status
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile && profile.is_blocked) {
        window.location.href = '/blocked.html';
        return;
    }
    currentProfile = profile;

    // Update Header
    const nameEl = document.getElementById('student-name');
    const emailEl = document.getElementById('student-email');
    const initialsEl = document.getElementById('student-initials');
    
    if (nameEl) nameEl.textContent = `${profile?.first_name || 'Student'} ${profile?.last_name || ''}`.trim();
    if (emailEl) emailEl.textContent = currentUser?.email || 'student@etutorconnect.com';
    if (initialsEl) initialsEl.textContent = (profile?.first_name?.[0] || 'S').toUpperCase();

    initDashboard();
});

function initDashboard() {
    // Nav Switching
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            showSection(target);
        });
    });

    // Search & Filter
    document.getElementById('course-search')?.addEventListener('input', debounce(() => loadExploreCourses(), 300));
    document.getElementById('course-filter')?.addEventListener('change', () => loadExploreCourses());

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });

    // Initial Load
    showSection('section-explore');
}

async function showSection(sectionId) {
    document.querySelectorAll('.section-view').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId)?.classList.remove('hidden');

    document.querySelectorAll('.nav-link').forEach(l => {
        if(l.dataset.target === sectionId) {
            l.classList.add('active', 'bg-emerald-50', 'text-emerald-700');
            l.classList.remove('text-gray-500');
        } else {
            l.classList.remove('active', 'bg-emerald-50', 'text-emerald-700');
            l.classList.add('text-gray-500');
        }
    });

    // Update header titles
    const titles = {
        'section-explore': ['Explore Courses', 'Discover top-rated courses and expert tutors'],
        'section-learning': ['My Learning', 'Continue your educational journey'],
        'section-sessions': ['Live Sessions', 'Manage your upcoming 1-on-1 classes'],
        'section-achievements': ['My Achievements', 'Celebrated milestones and completed courses']
    };
    if (titles[sectionId]) {
        document.getElementById('header-title').textContent = titles[sectionId][0];
        document.getElementById('header-subtitle').textContent = titles[sectionId][1];
    }

    if (sectionId === 'section-explore') loadExploreCourses();
    if (sectionId === 'section-learning') loadMyLearning();
    if (sectionId === 'section-sessions') loadLiveTutors();
    if (sectionId === 'section-achievements') loadAchievements();
}

async function loadExploreCourses() {
    const grid = document.getElementById('explore-grid');
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-gray-400">Loading courses...</div>';

    const search = document.getElementById('course-search').value.toLowerCase();
    const filter = document.getElementById('course-filter').value;

    // Fetch existing enrollments to prevent duplicates
    const { data: myEnrollments } = await supabase.from('student_progress').select('course_id').eq('student_id', currentUser.id);
    const enrolledIds = new Set(myEnrollments?.map(e => e.course_id) || []);

    let query = supabase.from('courses').select('*, profiles(first_name, last_name)').eq('status', 'Live');
    if (filter !== 'all') query = query.eq('course_type', filter);

    const { data: courses, error } = await query;
    if (error) return grid.innerHTML = 'Error loading courses';

    const filtered = courses.filter(c => c.title.toLowerCase().includes(search) || c.description.toLowerCase().includes(search));

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="col-span-full py-12 text-center text-gray-400">No courses match your search.</div>';
        return;
    }

    grid.innerHTML = filtered.map(c => {
        const isEnrolled = enrolledIds.has(c.id);
        const btnText = isEnrolled ? 'Continue Learning' : 'Enrol Now';
        const btnAction = isEnrolled ? `window.viewCourseContent('${c.id}')` : `window.enrollCourse('${c.id}', '${c.price}')`;
        const btnClass = isEnrolled ? "bg-emerald-100 text-emerald-700 px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-emerald-200 transition" : "bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-emerald-600 transition shadow-lg shadow-gray-200";

        return `
            <div class="course-card bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm transition-all duration-300">
                <div class="relative h-48 overflow-hidden group">
                    <img src="${getThumbnailUrl(c.thumbnail_url)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                    <div class="absolute top-4 left-4">
                        <span class="${c.course_type === 'Self-Paced' ? 'badge-self' : 'badge-cohort'}">${c.course_type}</span>
                    </div>
                </div>
                <div class="p-6">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${c.profiles?.first_name} ${c.profiles?.last_name}</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-2 leading-tight">${c.title}</h3>
                    <p class="text-sm text-gray-500 line-clamp-2 mb-4">${c.description || 'No description available.'}</p>
                    <div class="flex items-center justify-between pt-4 border-t border-gray-50">
                        <span class="text-xl font-black text-emerald-600">₹${c.price || 0}</span>
                        <button onclick="${btnAction}" class="${btnClass}">${btnText}</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadMyLearning() {
    const grid = document.getElementById('learning-grid');
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-gray-400">Loading your journey...</div>';

    const { data: progressEntries, error } = await supabase
        .from('student_progress')
        .select('course_id, is_completed, courses(*, profiles(first_name, last_name))')
        .eq('student_id', currentUser.id);

    if (error) return grid.innerHTML = 'Error loading progress';

    // Unique courses grouped by state
    const courseMap = new Map();
    progressEntries?.forEach(p => {
        if (!p.courses) return;
        const existing = courseMap.get(p.courses.id);
        if (!existing || p.is_completed) {
            courseMap.set(p.courses.id, p);
        }
    });

    const ongoingCourses = Array.from(courseMap.values())
        .filter(p => !p.is_completed)
        .map(p => p.courses);

    if (ongoingCourses.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="book-open" class="w-8 h-8 text-gray-300"></i>
                </div>
                <h4 class="text-lg font-bold text-gray-900">No courses yet</h4>
                <p class="text-gray-400 text-sm mb-6">Start your learning journey by exploring courses.</p>
                <button onclick="window.showSection('section-explore')" class="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-600 transition shadow-lg shadow-emerald-200">Browse Catalog</button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    grid.innerHTML = ongoingCourses.map(c => `
        <div class="course-card bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm transition-all duration-300">
             <div class="relative h-40 overflow-hidden">
                <img src="${getThumbnailUrl(c.thumbnail_url)}" class="w-full h-full object-cover grayscale-[0.2]">
                <div class="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <button onclick="window.viewCourseContent('${c.id}')" class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-emerald-600 hover:scale-110 transition shadow-xl">
                        <i data-lucide="play" class="w-6 h-6 fill-current"></i>
                    </button>
                </div>
            </div>
            <div class="p-6">
                <h3 class="text-base font-bold text-gray-900 mb-4 leading-tight">${c.title}</h3>
                <div class="flex items-center gap-2 mb-4 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                    <i data-lucide="external-link" class="w-4 h-4 text-emerald-600"></i>
                    <a href="${c.demo_video_url}" target="_blank" class="text-[11px] font-bold text-emerald-700 hover:underline">Watch Course Demo</a>
                </div>
                <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-2">
                    <div class="bg-emerald-500 h-full" style="width: 0%"></div>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">0% Complete</span>
                    <button onclick="window.viewCourseContent('${c.id}')" class="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition">Study Now</button>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

async function loadLiveTutors() {
    const list = document.getElementById('tutor-booking-list');
    list.innerHTML = '<div class="py-12 text-center text-gray-400">Finding tutors...</div>';

    const { data: tutors, error } = await supabase
        .from('tutor_profiles')
        .select('*, profiles(first_name, last_name, email)')
        .eq('status', 'APPROVED');

    if (error) return list.innerHTML = 'Error loading tutors';

    list.innerHTML = tutors.map(t => `
        <div class="p-6 bg-white border border-gray-100 rounded-[24px] flex flex-col md:flex-row items-center justify-between gap-6 hover:border-emerald-200 transition">
            <div class="flex items-center gap-5">
                <div class="w-14 h-14 rounded-2xl bg-gray-900 text-white flex items-center justify-center text-xl font-black">
                    ${(t.profiles?.first_name?.[0] || 'T').toUpperCase()}
                </div>
                <div>
                    <h4 class="font-bold text-gray-900">${t.profiles?.first_name} ${t.profiles?.last_name}</h4>
                    <p class="text-xs text-gray-400 font-medium">${t.category || 'Expert Instructor'}</p>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 font-bold rounded">★ ${t.rating || '4.9'}</span>
                        <span class="text-[10px] text-gray-300 font-bold">₹${t.base_rate || '500'}/session</span>
                    </div>
                </div>
            </div>
            <div class="flex gap-2 shrink-0">
                <button onclick="window.openBookingModal('${t.user_id}', '${t.profiles?.first_name}', '${t.category}')" class="bg-emerald-500 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-emerald-600 transition shadow-lg shadow-emerald-200">
                    See Availability
                </button>
            </div>
        </div>
    `).join('');
}

window.openBookingModal = async (tutorId, name, category) => {
    const modal = document.getElementById('booking-modal-overlay');
    const slotGrid = document.getElementById('modal-slots-grid');
    const profileDiv = document.getElementById('modal-tutor-profile');

    profileDiv.innerHTML = `
        <div class="w-12 h-12 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-xl">${name[0]}</div>
        <div>
            <p class="font-bold text-emerald-900 leading-none">${name}</p>
            <span class="text-xs text-emerald-600 font-medium tracking-tight">${category || 'Expert instructor'}</span>
        </div>
    `;

    slotGrid.innerHTML = '<p class="col-span-2 text-center text-gray-400 py-4">Checking slots...</p>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const { data: slots } = await supabase
        .from('tutor_slots')
        .select('*')
        .eq('tutor_id', tutorId)
        .eq('is_booked', false)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });

    if (!slots || slots.length === 0) {
        slotGrid.innerHTML = '<p class="col-span-2 text-center text-red-400 py-4 font-bold">No slots available</p>';
    } else {
        slotGrid.innerHTML = slots.map(s => {
            const date = new Date(s.start_time);
            return `
                <button onclick="selectSlot('${s.id}', '${s.start_time}', this)" class="slot-btn p-3 border border-gray-100 rounded-2xl text-[11px] font-bold text-gray-600 hover:border-emerald-500 hover:bg-emerald-50/30 transition text-left">
                    <div class="text-gray-400 mb-0.5">${date.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'})}</div>
                    <div class="text-emerald-600">${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                </button>
            `;
        }).join('');
    }
    lucide.createIcons();
};

window.closeBookingModal = () => {
    const modal = document.getElementById('booking-modal-overlay');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    window.selectedSlot = null;
};

window.selectSlot = (id, time, el) => {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('border-emerald-500', 'bg-emerald-50'));
    el.classList.add('border-emerald-500', 'bg-emerald-50');
    window.selectedSlot = { id, time };
};

document.getElementById('confirm-booking-btn')?.addEventListener('click', async (event) => {
    if (!window.selectedSlot) return alert('Select a slot first');
    
    // Fetch slot to get the tutor's rate
    const { data: slot } = await supabase.from('tutor_slots').select('*, tutor_profiles(base_rate)').eq('id', window.selectedSlot.id).single();
    if (!slot) return alert('Slot no longer available.');

    const price = Number(slot.tutor_profiles?.base_rate || 500);
    const btn = event.target;
    btn.disabled = true;
    
    const options = {
        key: "rzp_test_SbgDOfbMQRgseX",
        amount: price * 100,
        currency: "INR",
        name: "ETutorConnect",
        description: "1-on-1 Session Booking",
        handler: async function (response) {
            const { data: booking, error: bErr } = await supabase.from('bookings').insert({
                student_id: currentUser.id,
                tutor_id: slot.tutor_id,
                datetime: slot.start_time,
                status: 'Scheduled'
            }).select().single();

            if (bErr) return alert('Booking failed: ' + bErr.message);

            await supabase.from('payments').insert({
                booking_id: booking.id,
                amount: price,
                platform_fee: price * 0.1,
                tutor_share: price * 0.9
            });

            await supabase.from('tutor_slots').update({ is_booked: true, student_id: currentUser.id }).eq('id', slot.id);

            alert('Session Booked Successfully! Payment details recorded.');
            closeBookingModal();
            loadLiveTutors();
        },
        prefill: { email: currentUser.email },
        theme: { color: "#10b981" },
        modal: {
            ondismiss: function() {
                btn.disabled = false;
            }
        }
    };

    const rzp = new Razorpay(options);
    rzp.open();
});

window.enrollCourse = async (courseId, price) => {
    const amt = Number(price);
    if (amt === 0) {
        const { error } = await supabase.from('student_progress').insert({
            student_id: currentUser.id,
            course_id: courseId,
            is_completed: false
        });
        if (error) return alert('Enrollment failed: ' + error.message);
        alert('Enrolled successfully!');
        showSection('section-learning');
        return;
    }

    const options = {
        key: "rzp_test_SbgDOfbMQRgseX",
        amount: amt * 100,
        currency: "INR",
        name: "ETutorConnect",
        description: "Course Enrollment",
        handler: async function (response) {
            const { error: eErr } = await supabase.from('student_progress').insert({
                student_id: currentUser.id,
                course_id: courseId,
                is_completed: false
            });
            if (eErr) return alert('Enrollment Error: ' + eErr.message);
            
            await supabase.from('payments').insert({
                course_id: courseId,
                amount: amt,
                platform_fee: amt * 0.1,
                tutor_share: amt * 0.9
            });

            alert('Payment Successful! Course Added to Your Learning.');
            showSection('section-learning');
        },
        prefill: { email: currentUser.email },
        theme: { color: "#10b981" }
    };

    const rzp = new Razorpay(options);
    rzp.open();
};

function debounce(func, wait) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

window.viewCourseContent = (courseId) => {
    window.location.href = `learning.html?id=${courseId}`;
};

window.showSection = showSection;

async function loadAchievements() {
    const grid = document.getElementById('achievements-grid');
    grid.innerHTML = '<div class="col-span-full py-12 text-center text-gray-400">Loading your wins...</div>';

    const { data: progressEntries, error } = await supabase
        .from('student_progress')
        .select('is_completed, completed_at, courses(*, profiles(first_name, last_name))')
        .eq('student_id', currentUser.id);

    if (error) return grid.innerHTML = 'Error loading achievements';

    // Filter to only completed courses
    const courseMap = new Map();
    progressEntries?.forEach(p => {
        if (!p.courses) return;
        const existing = courseMap.get(p.courses.id);
        if (!existing || p.is_completed) {
            courseMap.set(p.courses.id, p);
        }
    });

    const completedEntries = Array.from(courseMap.values()).filter(p => p.is_completed);

    if (completedEntries.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-20 text-center">
                <div class="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-100">
                    <i data-lucide="award" class="w-8 h-8 text-orange-400"></i>
                </div>
                <h4 class="text-lg font-bold text-gray-900">No achievements yet</h4>
                <p class="text-gray-400 text-sm mb-6">Complete a course to see it listed here.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    grid.innerHTML = completedEntries.map(entry => {
        const c = entry.courses;
        const date = new Date(entry.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        return `
            <div class="course-card bg-white rounded-[32px] overflow-hidden border-2 border-emerald-100 shadow-xl shadow-emerald-50 relative group">
                <div class="absolute top-4 right-4 z-10">
                    <div class="bg-emerald-500 text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1">
                        <i data-lucide="check-circle" class="w-3 h-3"></i> Completed
                    </div>
                </div>
                <div class="relative h-40 overflow-hidden">
                    <img src="${getThumbnailUrl(c.thumbnail_url)}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute inset-0 bg-emerald-900/10"></div>
                </div>
                <div class="p-6">
                    <h3 class="text-base font-bold text-gray-900 mb-2 leading-tight">${c.title}</h3>
                    <p class="text-[10px] text-gray-400 font-bold uppercase mb-4 tracking-tighter">Completed on ${date}</p>
                    
                    <div class="flex items-center gap-2 mb-6 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                        <i data-lucide="external-link" class="w-4 h-4 text-emerald-600"></i>
                        <a href="${c.demo_video_url}" target="_blank" class="text-[11px] font-bold text-emerald-700 hover:underline">Watch Course Demo</a>
                    </div>

                    <button onclick="window.viewCourseContent('${c.id}')" class="w-full bg-emerald-600 text-white py-3 rounded-2xl text-xs font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                        <i data-lucide="refresh-ccw" class="w-3 h-3"></i>
                        Review Content
                    </button>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}
