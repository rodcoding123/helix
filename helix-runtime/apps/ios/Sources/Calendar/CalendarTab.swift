import SwiftUI

/// Main calendar tab view
struct CalendarTab: View {
    @Environment(NodeAppModel.self) private var appModel
    @State private var calendarStore: CalendarStore?
    @State private var selectedViewType: CalendarViewType = .month
    @State private var showAccountPicker = false
    @State private var showEventDetail = false

    var body: some View {
        NavigationStack {
            ZStack {
                if let store = calendarStore {
                    VStack(spacing: 0) {
                        // Header with account selector
                        VStack(spacing: 12) {
                            HStack {
                                Button(action: { showAccountPicker = true }) {
                                    if let accountName = store.accounts.first(where: { $0.id == store.selectedAccountId })?.displayName {
                                        Label(accountName, systemImage: "calendar")
                                            .font(.subheadline)
                                            .fontWeight(.semibold)
                                    } else {
                                        Label("Select Calendar", systemImage: "calendar")
                                            .font(.subheadline)
                                    }
                                }
                                .foregroundColor(.blue)

                                Spacer()

                                HStack(spacing: 12) {
                                    Button(action: { store.goToToday() }) {
                                        Text("Today")
                                            .font(.caption)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(Color.blue)
                                            .foregroundColor(.white)
                                            .cornerRadius(4)
                                    }

                                    Button(action: { store.goToPreviousMonth() }) {
                                        Image(systemName: "chevron.left")
                                    }

                                    Button(action: { store.goToNextMonth() }) {
                                        Image(systemName: "chevron.right")
                                    }
                                }
                                .foregroundColor(.blue)
                            }
                            .padding(.horizontal, 16)

                            // View selector
                            Picker("View", selection: $selectedViewType) {
                                Text("Month").tag(CalendarViewType.month)
                                Text("Week").tag(CalendarViewType.week)
                                Text("Day").tag(CalendarViewType.day)
                            }
                            .pickerStyle(.segmented)
                            .padding(.horizontal, 16)

                            // Date display
                            HStack {
                                Text(monthYearString(store.currentDate))
                                    .font(.headline)
                                    .fontWeight(.semibold)
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                        }
                        .padding(.vertical, 12)
                        .background(Color(.systemGray6))

                        // Calendar view
                        if store.isLoading {
                            ProgressView()
                                .frame(maxHeight: .infinity)
                        } else {
                            switch selectedViewType {
                            case .month:
                                MonthCalendarView(store: store)

                            case .week:
                                WeekCalendarView(store: store)

                            case .day:
                                DayCalendarView(store: store)
                            }
                        }

                        // Upcoming events footer
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Upcoming")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .padding(.horizontal, 16)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(store.upcomingEvents(limit: 3)) { event in
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(event.title)
                                                .font(.caption)
                                                .fontWeight(.semibold)
                                                .lineLimit(2)

                                            Text(timeString(event.startTime))
                                                .font(.caption2)
                                                .foregroundColor(.secondary)
                                        }
                                        .padding(8)
                                        .frame(width: 120, alignment: .topLeading)
                                        .background(Color.blue.opacity(0.1))
                                        .cornerRadius(4)
                                    }
                                }
                                .padding(.horizontal, 16)
                            }
                        }
                        .padding(.vertical, 12)
                        .background(Color(.systemGray6))
                    }
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Calendar")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showAccountPicker) {
                if let store = calendarStore {
                    AccountPickerView(store: store, isPresented: $showAccountPicker)
                }
            }
            .alert("Error", isPresented: .constant(calendarStore?.error != nil), presenting: calendarStore?.error) { _ in
                Button("OK") {
                    calendarStore?.error = nil
                }
            } message: { error in
                Text(error.localizedDescription)
            }
        }
        .onAppear {
            if calendarStore == nil {
                let service = CalendarService(gateway: appModel.gatewaySession)
                let store = CalendarStore(service: service)
                calendarStore = store

                Task {
                    await store.loadAccounts()
                    await store.loadEvents()
                }
            }
        }
    }

    private func monthYearString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }

    private func timeString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
}

// MARK: - Account Picker

struct AccountPickerView: View {
    @Bindable var store: CalendarStore
    @Binding var isPresented: Bool
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(store.accounts) { account in
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(account.displayName)
                                .fontWeight(.semibold)

                            Text(account.emailAddress)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        if account.id == store.selectedAccountId {
                            Image(systemName: "checkmark")
                                .foregroundColor(.blue)
                        }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        store.selectedAccountId = account.id
                        Task {
                            await store.loadEvents()
                        }
                        dismiss()
                    }
                }
            }
            .navigationTitle("Select Calendar")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Month Calendar View

struct MonthCalendarView: View {
    @Bindable var store: CalendarStore

    var body: some View {
        ScrollView {
            VStack(spacing: 4) {
                // Weekday headers
                HStack(spacing: 0) {
                    ForEach(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], id: \.self) { day in
                        Text(day)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                    }
                }
                .padding(.vertical, 8)

                // Calendar grid
                VStack(spacing: 4) {
                    let daysInMonth = daysInMonth(store.currentDate)
                    let firstWeekday = firstWeekday(of: store.currentDate)
                    let weeks = (firstWeekday + daysInMonth - 1 + 6) / 7

                    ForEach(0..<weeks, id: \.self) { week in
                        HStack(spacing: 4) {
                            ForEach(0..<7, id: \.self) { day in
                                let dayNumber = (week * 7 + day) - firstWeekday + 1

                                if dayNumber > 0 && dayNumber <= daysInMonth {
                                    let date = Calendar.current.date(
                                        byAdding: .day,
                                        value: dayNumber - 1,
                                        to: Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: store.currentDate))!
                                    ) ?? Date()

                                    let events = store.eventsForDate(date)
                                    let isToday = Calendar.current.isDateInToday(date)

                                    VStack(spacing: 2) {
                                        Text("\(dayNumber)")
                                            .font(.caption)
                                            .fontWeight(isToday ? .semibold : .regular)
                                            .foregroundColor(isToday ? .blue : .primary)

                                        if !events.isEmpty {
                                            Circle()
                                                .fill(Color.orange)
                                                .frame(width: 4, height: 4)
                                        }
                                    }
                                    .frame(maxWidth: .infinity, minHeight: 40)
                                    .background(isToday ? Color.blue.opacity(0.1) : Color.clear)
                                    .cornerRadius(4)
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        store.currentDate = date
                                    }
                                } else {
                                    Color.clear
                                        .frame(maxWidth: .infinity, minHeight: 40)
                                }
                            }
                        }
                    }
                }
            }
            .padding(12)
        }
    }

    private func daysInMonth(_ date: Date) -> Int {
        Calendar.current.range(of: .day, in: .month, for: date)?.count ?? 31
    }

    private func firstWeekday(of date: Date) -> Int {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month], from: date)
        let firstDay = calendar.date(from: components) ?? date
        return calendar.component(.weekday, from: firstDay) - 1
    }
}

// MARK: - Week Calendar View

struct WeekCalendarView: View {
    @Bindable var store: CalendarStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Week view")
                    .foregroundColor(.secondary)

                Text("Coming soon")
            }
            .padding(16)
        }
    }
}

// MARK: - Day Calendar View

struct DayCalendarView: View {
    @Bindable var store: CalendarStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Day view")
                    .foregroundColor(.secondary)

                Text("Coming soon")
            }
            .padding(16)
        }
    }
}

#Preview {
    CalendarTab()
        .environment(NodeAppModel(gatewaySession: GatewaySession()))
}
