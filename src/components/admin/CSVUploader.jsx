import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';


// Sanitize CSV cells to prevent formula injection
function sanitizeCell(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

// Parse CSV content
function parseCSV(content, delimiter = ',') {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const headers = lines[0].split(delimiter).map(h => sanitizeCell(h));
  const rows = lines.slice(1).map((line, idx) => {
    const values = line.split(delimiter).map(v => sanitizeCell(v));
    const row = { _rowNum: idx + 2 };
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });
  
  return { headers, rows };
}

export default function CSVUploader({
  title,
  description,
  expectedColumns,
  onValidate,
  onConfirm,
  renderPreviewRow,
}) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState('skip'); // 'skip' or 'overwrite'

  const handleFileChange = useCallback(async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setParsedData(null);
    setValidationResult(null);
    
    const text = await selectedFile.text();
    const { headers, rows } = parseCSV(text);
    
    setParsedData({ headers, rows });
    
    // Auto-validate
    setIsValidating(true);
    try {
      const result = await onValidate(rows, headers);
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        isValid: false,
        errors: [{ row: 0, message: error.message }],
        warnings: [],
        stats: {},
      });
    } finally {
      setIsValidating(false);
    }
  }, [onValidate]);

  const handleConfirm = async () => {
    if (!parsedData || !validationResult?.isValid) return;
    
    setIsUploading(true);
    try {
      await onConfirm(parsedData.rows, uploadMode);
      // Reset state after successful upload
      setFile(null);
      setParsedData(null);
      setValidationResult(null);
    } catch (error) {
      setValidationResult({
        ...validationResult,
        errors: [{ row: 0, message: error.message }],
      });
    } finally {
      setIsUploading(false);
    }
  };

  const fileInputRef = React.useRef(null);

  const reset = () => {
    setFile(null);
    setParsedData(null);
    setValidationResult(null);
    // Reset the file input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-teal-600" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* File Input */}
        {!file && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-teal-300 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="font-medium text-gray-700">Drop your CSV file here or click to browse</p>
              <p className="text-sm text-gray-500 mt-2">
                Expected columns: {expectedColumns.join(', ')}
              </p>
            </label>
          </div>
        )}

        {/* File Selected */}
        {file && (
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-teal-600" />
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {parsedData ? `${parsedData.rows.length} rows` : 'Parsing...'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={reset}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Validation Loading */}
        {isValidating && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            <span className="ml-3 text-gray-600">Validating data...</span>
          </div>
        )}

        {/* Validation Results */}
        {validationResult && !isValidating && (
          <div className="space-y-4">
            {/* Stats */}
            {validationResult.stats && (
              <div className="flex flex-wrap gap-3">
                {Object.entries(validationResult.stats).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-sm">
                    {key}: {value}
                  </Badge>
                ))}
              </div>
            )}

            {/* Errors */}
            {validationResult.errors?.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Errors found:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validationResult.errors.slice(0, 10).map((error, i) => (
                      <li key={i}>
                        {error.row > 0 && <span className="font-medium">Row {error.row}:</span>} {error.message}
                      </li>
                    ))}
                    {validationResult.errors.length > 10 && (
                      <li>...and {validationResult.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Remove & retry button on errors */}
            {validationResult.errors?.length > 0 && (
              <Button variant="outline" onClick={reset} className="w-full">
                <X className="w-4 h-4 mr-2" />
                Remove file & try again
              </Button>
            )}

            {/* Warnings */}
            {validationResult.warnings?.length > 0 && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <div className="font-medium mb-2">Warnings:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validationResult.warnings.slice(0, 5).map((warning, i) => (
                      <li key={i}>{warning.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Success */}
            {validationResult.isValid && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Validation passed! Ready to import.
                </AlertDescription>
              </Alert>
            )}

            {/* Preview Table */}
            {parsedData && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Preview (first 10 rows)</h4>
                <div className="h-64 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        {parsedData.headers.map(header => (
                          <TableHead key={header}>{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.rows.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-gray-500">{row._rowNum}</TableCell>
                          {renderPreviewRow ? (
                            renderPreviewRow(row, parsedData.headers)
                          ) : (
                            parsedData.headers.map(header => (
                              <TableCell key={header}>{row[header]}</TableCell>
                            ))
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Duplicate Handling */}
            {validationResult.hasDuplicates && validationResult.isValid && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="font-medium text-gray-900 mb-3">How to handle duplicates?</p>
                <div className="flex gap-3">
                  <Button
                    variant={uploadMode === 'skip' ? 'default' : 'outline'}
                    onClick={() => setUploadMode('skip')}
                    className={uploadMode === 'skip' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                  >
                    Skip Duplicates
                  </Button>
                  <Button
                    variant={uploadMode === 'overwrite' ? 'default' : 'outline'}
                    onClick={() => setUploadMode('overwrite')}
                    className={uploadMode === 'overwrite' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                  >
                    Overwrite Existing
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Footer Actions */}
      {validationResult?.isValid && !isValidating && (
        <CardFooter className="flex justify-end gap-3 border-t pt-6">
          <Button variant="outline" onClick={reset}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isUploading}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              'Confirm Import'
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}