import Foundation
import PDFKit

let arguments = CommandLine.arguments
guard arguments.count > 1 else {
    print("Error: No file path provided.")
    exit(1)
}

let filePath = arguments[1]
let fileURL = URL(fileURLWithPath: filePath)

guard let document = PDFDocument(url: fileURL) else {
    print("Error: Could not load PDF document at \(filePath)")
    exit(1)
}

var fullText = ""
for i in 0..<document.pageCount {
    if let page = document.page(at: i), let pageText = page.string {
        fullText += pageText + "\n"
    }
}

print(fullText)
