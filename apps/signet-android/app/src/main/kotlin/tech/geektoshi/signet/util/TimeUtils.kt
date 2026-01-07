package tech.geektoshi.signet.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * Formats an ISO timestamp as a relative time string.
 * Examples: "Just now", "2m ago", "1h ago", "Yesterday", "Dec 25"
 */
fun formatRelativeTime(timestamp: String): String {
    return try {
        val instant = Instant.parse(timestamp)
        val now = Instant.now()
        val seconds = ChronoUnit.SECONDS.between(instant, now)
        val minutes = ChronoUnit.MINUTES.between(instant, now)
        val hours = ChronoUnit.HOURS.between(instant, now)
        val days = ChronoUnit.DAYS.between(instant, now)

        when {
            seconds < 60 -> "Just now"
            minutes < 60 -> "${minutes}m ago"
            hours < 24 -> "${hours}h ago"
            days == 1L -> "Yesterday"
            days < 7 -> "${days}d ago"
            else -> {
                val localDate = instant.atZone(ZoneId.systemDefault()).toLocalDate()
                val formatter = DateTimeFormatter.ofPattern("MMM d")
                localDate.format(formatter)
            }
        }
    } catch (e: Exception) {
        timestamp
    }
}

/**
 * Categorizes a timestamp into a date group for section headers.
 */
enum class DateGroup {
    TODAY,
    YESTERDAY,
    THIS_WEEK,
    OLDER
}

fun getDateGroup(timestamp: String): DateGroup {
    return try {
        val instant = Instant.parse(timestamp)
        val date = instant.atZone(ZoneId.systemDefault()).toLocalDate()
        val today = LocalDate.now()
        val yesterday = today.minusDays(1)
        val weekAgo = today.minusDays(7)

        when {
            date == today -> DateGroup.TODAY
            date == yesterday -> DateGroup.YESTERDAY
            date.isAfter(weekAgo) -> DateGroup.THIS_WEEK
            else -> DateGroup.OLDER
        }
    } catch (e: Exception) {
        DateGroup.OLDER
    }
}

fun DateGroup.toDisplayString(): String = when (this) {
    DateGroup.TODAY -> "Today"
    DateGroup.YESTERDAY -> "Yesterday"
    DateGroup.THIS_WEEK -> "This Week"
    DateGroup.OLDER -> "Older"
}

/**
 * Formats uptime in seconds to a human-readable string.
 * Uses 2 significant units max, switches to months/years for long uptimes.
 * Examples: "45s", "5h 30m", "3d 12h", "2mo 15d", "1y 3mo"
 */
fun formatUptime(seconds: Int): String {
    if (seconds < 60) return "${seconds}s"

    val minutes = seconds / 60
    if (minutes < 60) return "${minutes}m"

    val hours = seconds / 3600
    if (hours < 24) {
        val mins = (seconds % 3600) / 60
        return if (mins > 0) "${hours}h ${mins}m" else "${hours}h"
    }

    val days = seconds / 86400
    if (days < 30) {
        val hrs = (seconds % 86400) / 3600
        return if (hrs > 0) "${days}d ${hrs}h" else "${days}d"
    }

    // 30+ days: use months
    val months = days / 30
    if (days < 365) {
        val remainingDays = days % 30
        return if (remainingDays > 0) "${months}mo ${remainingDays}d" else "${months}mo"
    }

    // 365+ days: use years
    val years = days / 365
    val remainingMonths = (days % 365) / 30
    return if (remainingMonths > 0) "${years}y ${remainingMonths}mo" else "${years}y"
}

/**
 * Formats a future ISO timestamp as a compact string.
 * Examples: "3:45 PM", "Jan 5, 3:45 PM", "Jan 5, 2027"
 */
fun formatFutureTime(timestamp: String): String {
    return try {
        val instant = Instant.parse(timestamp)
        val now = Instant.now()
        val zonedDateTime = instant.atZone(ZoneId.systemDefault())
        val today = LocalDate.now()
        val targetDate = zonedDateTime.toLocalDate()

        when {
            // If less than 24 hours from now, just show time
            ChronoUnit.HOURS.between(now, instant) < 24 && targetDate == today -> {
                zonedDateTime.format(DateTimeFormatter.ofPattern("h:mm a"))
            }
            // Same year - show month, day, time
            targetDate.year == today.year -> {
                zonedDateTime.format(DateTimeFormatter.ofPattern("MMM d, h:mm a"))
            }
            // Different year - show month, day, year
            else -> {
                zonedDateTime.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))
            }
        }
    } catch (e: Exception) {
        timestamp
    }
}
