Add-Type -AssemblyName System.Security
$localStatePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Local State"
$content = Get-Content $localStatePath -Raw -Encoding UTF8
if ($content -match '"encrypted_key"\s*:\s*"([^"]+)"') {
    $encB64 = $Matches[1]
    $encBytes = [System.Convert]::FromBase64String($encB64)
    $encBytes = $encBytes[5..($encBytes.Length - 1)]
    $aesKey = [System.Security.Cryptography.ProtectedData]::Unprotect(
        $encBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    [System.Convert]::ToBase64String($aesKey)
} else {
    Write-Error "encrypted_key not found in Local State"
    exit 1
}
