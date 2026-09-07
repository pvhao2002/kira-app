import Foundation
import HealthKit

@MainActor
final class HealthReader {
    let store = HKHealthStore()
    let quantities: [HKQuantityType] = [.quantityType(forIdentifier: .activeEnergyBurned)!,
        .quantityType(forIdentifier: .basalEnergyBurned)!, .quantityType(forIdentifier: .stepCount)!]
    var sampleTypes: [HKSampleType] { quantities.map { $0 as HKSampleType } + [HKObjectType.workoutType()] }
    private var observers: [HKObserverQuery] = []

    func authorize() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { throw LifeError(code: "HEALTH_UNAVAILABLE") }
        try await store.requestAuthorization(toShare: [], read: Set(sampleTypes.map { $0 as HKObjectType }))
        // The result describes the permission request, never whether read permission was granted.
    }
    func observe(onChange: @escaping () async -> Void) {
        guard observers.isEmpty, HKHealthStore.isHealthDataAvailable() else { return }
        for type in sampleTypes {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, error in
                guard error == nil else { completion(); return }
                Task { @MainActor in await onChange(); completion() }
            }
            observers.append(query); store.execute(query)
            store.enableBackgroundDelivery(for: type, frequency: .hourly) { _, _ in }
        }
    }
    func stop() {
        observers.forEach { store.stop($0) }; observers.removeAll()
        store.disableAllBackgroundDelivery { _, _ in }
    }
    func calendar(_ timezone: String) throws -> Calendar {
        guard let zone = TimeZone(identifier: timezone) else { throw LifeError(code: "HEALTH_TIMEZONE_INVALID") }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = zone; return calendar
    }
    func dayString(_ date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }
    func date(_ value: String, calendar: Calendar) throws -> Date {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) else { throw LifeError(code: "HEALTH_DATE_INVALID") }
        return date
    }
    func dates(from: Date, through: Date, calendar: Calendar) -> [String] {
        var day = calendar.startOfDay(for: from); let end = calendar.startOfDay(for: through)
        var result: [String] = []
        while day <= end {
            result.append(dayString(day, calendar: calendar))
            guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }; day = next
        }
        return result
    }
    private func changes(type: HKSampleType, anchor: HKQueryAnchor?, since: Date) async throws -> ([HKSample], [HKDeletedObject], HKQueryAnchor?) {
        try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: [])
            let query = HKAnchoredObjectQuery(type: type, predicate: predicate, anchor: anchor, limit: HKObjectQueryNoLimit) { _, added, removed, next, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: (added ?? [], removed ?? [], next)) }
            }
            store.execute(query)
        }
    }
    func collectChanges(_ current: SyncState) async throws -> SyncState {
        var state = current
        let cal = try calendar(state.timezone)
        for type in sampleTypes {
            var anchor: HKQueryAnchor?
            if let data = state.anchors[type.identifier] { anchor = try NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data) }
            let (added, removed, next) = try await changes(type: type, anchor: anchor, since: state.initialStart)
            for sample in added {
                let days = dates(from: max(sample.startDate, state.initialStart), through: min(sample.endDate, Date()), calendar: cal)
                let key = type.identifier + ":" + sample.uuid.uuidString
                if let old = state.sampleDates[key] { state.dirtyDates.formUnion(old) }
                state.sampleDates[key] = days; state.dirtyDates.formUnion(days)
            }
            for sample in removed {
                let key = type.identifier + ":" + sample.uuid.uuidString
                if let days = state.sampleDates.removeValue(forKey: key) { state.dirtyDates.formUnion(days) }
                else { state.dirtyDates.formUnion(dates(from: state.initialStart, through: Date(), calendar: cal)) }
            }
            if let next { state.anchors[type.identifier] = try NSKeyedArchiver.archivedData(withRootObject: next, requiringSecureCoding: true) }
        }
        // Re-read recent days even without new samples (read-access changes cannot be queried explicitly).
        let recent = cal.date(byAdding: .day, value: -1, to: Date())!
        state.dirtyDates.formUnion(dates(from: max(state.initialStart, recent), through: Date(), calendar: cal))
        return state
    }
    private func sum(_ type: HKQuantityType, unit: HKUnit, start: Date, end: Date, calendar: Calendar) async throws -> Double? {
        let healthStore = store
        return try await withCheckedThrowingContinuation { continuation in
            var interval = DateComponents(); interval.day = 1; interval.calendar = calendar; interval.timeZone = calendar.timeZone
            let query = HKStatisticsCollectionQuery(quantityType: type,
                quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end, options: []),
                options: .cumulativeSum, anchorDate: start, intervalComponents: interval)
            query.initialResultsHandler = { query, results, error in
                healthStore.stop(query)
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: results?.statistics(for: start)?.sumQuantity()?.doubleValue(for: unit)) }
            }
            store.execute(query)
        }
    }
    private func workouts(start: Date, end: Date) async throws -> [HKWorkout] {
        try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
            let query = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: (samples as? [HKWorkout] ?? []).filter { $0.startDate < end }) }
            }
            store.execute(query)
        }
    }
    private func workoutName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return L.text("Running", "Chạy bộ")
        case .walking: return L.text("Walking", "Đi bộ")
        case .cycling: return L.text("Cycling", "Đạp xe")
        case .swimming: return L.text("Swimming", "Bơi")
        case .yoga: return "Yoga"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return L.text("Strength training", "Tập sức mạnh")
        case .highIntensityIntervalTraining: return "HIIT"
        default: return L.text("Workout", "Buổi tập")
        }
    }
    func snapshot(_ day: String, timezone: String) async throws -> DayPayload {
        let cal = try calendar(timezone), start = try date(day, calendar: cal)
        let end = cal.date(byAdding: .day, value: 1, to: start)!
        let active = try await sum(quantities[0], unit: .kilocalorie(), start: start, end: end, calendar: cal)
        let rest = try await sum(quantities[1], unit: .kilocalorie(), start: start, end: end, calendar: cal)
        let steps = try await sum(quantities[2], unit: .count(), start: start, end: end, calendar: cal)
        let records = try await workouts(start: start, end: end)
        let formatter = ISO8601DateFormatter()
        let values = records.map { w in
            WorkoutPayload(id: w.uuid.uuidString.lowercased(), start: formatter.string(from: w.startDate), end: formatter.string(from: w.endDate),
                type: workoutName(w.workoutActivityType), calories: w.statistics(for: quantities[0])?.sumQuantity()?.doubleValue(for: .kilocalorie()),
                source: w.sourceRevision.source.name)
        }
        return DayPayload(date: day, activeCalories: active, restingCalories: rest, steps: steps.map { Int64($0.rounded()) }, workouts: values)
    }
}
