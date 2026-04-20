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
    loadStudentNotifications();
}

async function loadStudentNotifications() {
    const list = document.getElementById('student-notifications-list');
    const badge = document.getElementById('student-notification-badge');

    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

    if (error) {
        if(list) list.innerHTML = '<p class="text-red-500 text-sm">Failed to load notifications.</p>';
        return;
    }

    if (notifications && notifications.length > 0) {
        badge.textContent = notifications.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    if (!notifications || notifications.length === 0) {
        list.innerHTML = `
            <div class="py-12 text-center text-gray-400">
                <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-3 text-gray-200"></i>
                <p class="font-bold">Inbox is empty</p>
                <p class="text-xs mt-1">You have no new messages or replies.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="p-6 bg-white border border-gray-100 rounded-[20px] shadow-sm flex flex-col gap-3">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <i data-lucide="message-circle" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-gray-900 leading-tight">${n.title}</h4>
                        <span class="text-[10px] font-bold text-gray-400">${new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <button onclick="window.markStudentNotificationRead('${n.id}')" class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded hover:bg-emerald-100 transition">Mark as Read</button>
            </div>
            <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap ml-14">${n.message}</p>
        </div>
    `).join('');
    lucide.createIcons();
}

window.markStudentNotificationRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    loadStudentNotifications();
};

window.markAllStudentNotificationsAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id);
    loadStudentNotifications();
};

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
        'section-achievements': ['My Achievements', 'Celebrated milestones and completed courses'],
        'section-notifications': ['Inbox & Replies', 'Direct messages and updates from your tutors']
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

    let query = supabase.from('courses').select('*, profiles(first_name, last_name)').in('status', ['Live', 'Scheduled']);
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
                <div class="relative h-48 overflow-hidden group cursor-pointer" onclick="window.openCourseDetail('${c.id}')">
                    <img src="${getThumbnailUrl(c.thumbnail_url)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                    <div class="absolute top-4 left-4">
                        <span class="${c.course_type === 'Self-Paced' ? 'badge-self' : 'badge-cohort'}">${c.course_type}</span>
                    </div>
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span class="bg-white/90 text-gray-900 px-4 py-2 rounded-full text-xs font-bold shadow">View Details</span>
                    </div>
                </div>
                <div class="p-6">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${c.profiles?.first_name} ${c.profiles?.last_name}</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900 mb-2 leading-tight">${c.title}</h3>
                    <p class="text-sm text-gray-500 line-clamp-2 mb-3">${c.description || 'No description available.'}</p>
                    <button onclick="window.openCourseDetail('${c.id}')" class="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition mb-4 inline-block">Read more →</button>
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
                ${c.demo_video_url ? `<div class="flex items-center gap-2 mb-4 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                    <i data-lucide="external-link" class="w-4 h-4 text-emerald-600"></i>
                    <a href="${c.demo_video_url}" target="_blank" class="text-[11px] font-bold text-emerald-700 hover:underline">Watch Course Demo</a>
                </div>` : ''}
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
    window.location.href = `/student/learning.html?id=${courseId}`;
};

window.showSection = showSection;

window.openCourseDetail = async (courseId) => {
    const modal = document.getElementById('course-detail-modal');
    modal.innerHTML = '<div class="flex items-center justify-center w-full h-full"><p class="text-white text-sm font-bold">Loading...</p></div>';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const { data: course, error } = await supabase
        .from('courses')
        .select('*, profiles(first_name, last_name), modules(count)')
        .eq('id', courseId)
        .single();

    if (error || !course) {
        modal.innerHTML = '<div class="text-red-400">Failed to load course</div>';
        return;
    }

    const { data: myEnrollments } = await supabase.from('student_progress').select('course_id').eq('student_id', currentUser.id).eq('course_id', courseId);
    const isEnrolled = myEnrollments && myEnrollments.length > 0;
    const isLiveCohort = course.course_type === 'Live-Cohort';

    // Build demo video embed
    let demoVideoHtml = '';
    if (course.demo_video_url) {
        let demoEmbed = course.demo_video_url;
        const isDrive = demoEmbed.includes('drive.google.com');
        const isYoutube = demoEmbed.includes('youtube.com') || demoEmbed.includes('youtu.be');

        if (isDrive) {
            demoEmbed = demoEmbed.replace('/view', '/preview').replace('/edit', '/preview');
        } else if (isYoutube) {
            let videoId = '';
            try {
                if (demoEmbed.includes('youtu.be/')) videoId = demoEmbed.split('youtu.be/')[1].split('?')[0];
                else if (demoEmbed.includes('youtube.com/watch')) videoId = new URL(demoEmbed).searchParams.get('v');
                else if (demoEmbed.includes('youtube.com/embed/')) videoId = demoEmbed.split('youtube.com/embed/')[1].split('?')[0];
            } catch(e) {}
            if (videoId) demoEmbed = `https://www.youtube.com/embed/${videoId}`;
        }

        demoVideoHtml = `
            <div class="mb-6">
                <h4 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Demo / Preview Video</h4>
                <div class="relative w-full aspect-video bg-gray-900 overflow-hidden border border-gray-200">
                    <iframe src="${demoEmbed}" class="absolute inset-0 w-full h-full" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
                </div>
            </div>
        `;
    }

    // Cohort schedule info
    let scheduleHtml = '';
    if (isLiveCohort) {
        const days = course.cohort_days?.join(', ') || 'Not set';
        const startTime = course.start_time?.slice(0, 5) || '--:--';
        const endTime = course.end_time?.slice(0, 5) || '--:--';
        scheduleHtml = `
            <div class="mb-6">
                <h4 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Live Class Schedule</h4>
                <div class="flex items-center gap-3 flex-wrap">
                    <div class="bg-emerald-50 border border-emerald-100 px-4 py-2.5 flex items-center gap-2">
                        <i data-lucide="calendar" class="w-4 h-4 text-emerald-600"></i>
                        <span class="text-sm font-bold text-emerald-700">${days}</span>
                    </div>
                    <div class="bg-blue-50 border border-blue-100 px-4 py-2.5 flex items-center gap-2">
                        <i data-lucide="clock" class="w-4 h-4 text-blue-600"></i>
                        <span class="text-sm font-bold text-blue-700">${startTime} - ${endTime}</span>
                    </div>
                    <div class="bg-purple-50 border border-purple-100 px-4 py-2.5 flex items-center gap-2">
                        <i data-lucide="users" class="w-4 h-4 text-purple-600"></i>
                        <span class="text-sm font-bold text-purple-700">Live Group Sessions</span>
                    </div>
                </div>
            </div>
        `;
    }

    const btnAction = isEnrolled
        ? `window.closeCourseDetail(); window.viewCourseContent('${course.id}')`
        : `window.closeCourseDetail(); window.enrollCourse('${course.id}', '${course.price}')`;
    const btnText = isEnrolled ? 'Continue Learning' : `Enrol Now — ₹${course.price || 0}`;
    const btnClass = isEnrolled
        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        : 'bg-gray-900 text-white hover:bg-emerald-600 shadow-lg shadow-gray-200';

    modal.innerHTML = `
        <div class="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn" style="border-radius: 0 !important;">
            <!-- Thumbnail -->
            <div class="relative h-56 overflow-hidden">
                <img src="${getThumbnailUrl(course.thumbnail_url)}" class="w-full h-full object-cover">
                <div class="absolute top-4 left-4">
                    <span class="${course.course_type === 'Self-Paced' ? 'badge-self' : 'badge-cohort'}">${course.course_type}</span>
                </div>
                <button onclick="window.closeCourseDetail()" class="absolute top-4 right-4 w-10 h-10 bg-white/90 flex items-center justify-center text-gray-600 hover:text-gray-900 transition shadow">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <!-- Content -->
            <div class="p-8">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${course.profiles?.first_name} ${course.profiles?.last_name}</span>
                    <span class="text-gray-200">•</span>
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${course.modules?.[0]?.count || 0} Modules</span>
                </div>
                <h2 class="text-2xl font-black text-gray-900 mb-4 leading-tight">${course.title}</h2>
                
                <!-- Full Description -->
                <div class="mb-6">
                    <h4 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">About This Course</h4>
                    <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">${course.description || 'No description provided.'}</p>
                </div>

                ${scheduleHtml}
                ${demoVideoHtml}

                <!-- Footer -->
                <div class="flex items-center justify-between pt-6 border-t border-gray-100">
                    <div>
                        <span class="text-3xl font-black text-emerald-600">₹${course.price || 0}</span>
                        ${course.price > 0 ? '<p class="text-[10px] text-gray-400 mt-0.5">One-time payment</p>' : '<p class="text-[10px] text-emerald-500 font-bold mt-0.5">FREE</p>'}
                    </div>
                    <button onclick="${btnAction}" class="px-8 py-3.5 font-bold text-sm transition ${btnClass}">
                        ${btnText}
                    </button>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
};

window.closeCourseDetail = () => {
    const modal = document.getElementById('course-detail-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.innerHTML = '';
};

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
                    
                    ${c.demo_video_url ? `<div class="flex items-center gap-2 mb-6 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                        <i data-lucide="external-link" class="w-4 h-4 text-emerald-600"></i>
                        <a href="${c.demo_video_url}" target="_blank" class="text-[11px] font-bold text-emerald-700 hover:underline">Watch Course Demo</a>
                    </div>` : ''}

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
