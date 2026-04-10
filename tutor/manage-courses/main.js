import { renderSelfPacedView } from './self-paced.js';
import { renderCohortView } from './cohort.js';
import { renderOneOnOneView } from './one-on-one.js';
import { supabase } from '../../src/supabase.js';

export async function initManageCourses(containerId) {
    const { data: { session } } = await supabase.auth.getSession();
    const tutorId = session?.user?.id;

    const container = document.getElementById(containerId);
    
    window.manageCoursesState = {
        showView: function(view) {
            if (view === 'main') {
                this.renderMain();
            } else if (view === 'self-paced') {
                renderSelfPacedView(containerId);
            } else if (view === 'cohort') {
                renderCohortView(containerId);
            } else if (view === 'one-on-one') {
                renderOneOnOneView(containerId);
            }
        },
        renderMain: async function() {
            container.innerHTML = `
                <div class="animate-fadeIn">
                    <h2 class="text-2xl font-bold text-gray-900 mb-8">Manage Your Courses</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8" id="hub-cards">
                        <div class="col-span-3 flex justify-center py-20 text-gray-400">Loading your course data...</div>
                    </div>
                </div>
            `;
            lucide.createIcons();

            const { data: courses } = await supabase.from('courses').select('course_type').eq('tutor_id', tutorId);
            const { data: bookings } = await supabase.from('bookings').select('id').eq('tutor_id', tutorId);

            const spCount = courses?.filter(c => c.course_type === 'Self-Paced').length || 0;
            const cohortCount = courses?.filter(c => c.course_type === 'Live-Cohort').length || 0;
            const oooCount = bookings?.length || 0;

            container.querySelector('#hub-cards').innerHTML = `
                <!-- Self-Paced Card -->
                <div onclick="window.manageCoursesState.showView('self-paced')" class="group bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 cursor-pointer flex flex-col min-h-[300px] relative overflow-hidden">
                    <div class="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-emerald-100 transition">
                        <i data-lucide="play-circle" class="w-7 h-7 text-emerald-600"></i>
                    </div>
                    <div class="absolute right-8 top-10 opacity-40 group-hover:opacity-100 transition transform group-hover:translate-x-1">
                        <i data-lucide="arrow-right" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-[24px] font-bold text-gray-900 mb-3">Self-Paced</h3>
                    <p class="text-gray-500 leading-relaxed mb-auto">Pre-recorded video courses with quizzes</p>
                    <div class="mt-8 pt-6 border-t border-gray-100/60 flex items-center justify-between">
                        <span class="text-sm font-semibold text-gray-600">${spCount} courses</span>
                    </div>
                </div>

                <!-- Cohort Card -->
                <div onclick="window.manageCoursesState.showView('cohort')" class="group bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 cursor-pointer flex flex-col min-h-[300px] relative overflow-hidden">
                    <div class="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-emerald-100 transition">
                        <i data-lucide="users" class="w-7 h-7 text-emerald-600"></i>
                    </div>
                    <div class="absolute right-8 top-10 opacity-40 group-hover:opacity-100 transition transform group-hover:translate-x-1">
                        <i data-lucide="arrow-right" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-[24px] font-bold text-gray-900 mb-3">Cohort</h3>
                    <p class="text-gray-500 leading-relaxed mb-auto">Live group learning with scheduled sessions</p>
                    <div class="mt-8 pt-6 border-t border-gray-100/60 flex items-center justify-between">
                        <span class="text-sm font-semibold text-gray-600">${cohortCount} cohorts</span>
                    </div>
                </div>

                <!-- 1-on-1 Card -->
                <div onclick="window.manageCoursesState.showView('one-on-one')" class="group bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all duration-300 cursor-pointer flex flex-col min-h-[300px] relative overflow-hidden">
                    <div class="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-emerald-100 transition">
                        <i data-lucide="user-check" class="w-7 h-7 text-emerald-600"></i>
                    </div>
                    <div class="absolute right-8 top-10 opacity-40 group-hover:opacity-100 transition transform group-hover:translate-x-1">
                        <i data-lucide="arrow-right" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-[24px] font-bold text-gray-900 mb-3">1-on-1</h3>
                    <p class="text-gray-500 leading-relaxed mb-auto">Personal sessions with individual students</p>
                    <div class="mt-8 pt-6 border-t border-gray-100/60 flex items-center justify-between">
                        <span class="text-sm font-semibold text-gray-600">${oooCount} sessions</span>
                    </div>
                </div>
            `;
            lucide.createIcons();
        }
    };

    window.manageCoursesState.showView('main');
}
